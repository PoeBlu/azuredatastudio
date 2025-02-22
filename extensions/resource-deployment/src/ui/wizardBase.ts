/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { WizardPageBase } from './wizardPageBase';
import { Model } from './model';
const localize = nls.loadMessageBundle();

export abstract class WizardBase<T, M extends Model> {
	private customButtons: azdata.window.Button[] = [];
	private pages: WizardPageBase<T>[] = [];

	public wizardObject: azdata.window.Wizard;
	public toDispose: vscode.Disposable[] = [];
	public get model(): M {
		return this._model;
	}

	constructor(private title: string, private _model: M) {
		this.wizardObject = azdata.window.createWizard(title);
	}

	public open(): Thenable<void> {
		this.initialize();
		this.wizardObject.customButtons = this.customButtons;
		this.toDispose.push(this.wizardObject.onPageChanged((e) => {
			let previousPage = this.pages[e.lastPage];
			let newPage = this.pages[e.newPage];
			previousPage.onLeave();
			newPage.onEnter();
		}));

		this.toDispose.push(this.wizardObject.doneButton.onClick(() => {
			this.onOk();
			this.dispose();
		}));
		this.toDispose.push(this.wizardObject.cancelButton.onClick(() => {
			this.onCancel();
			this.dispose();
		}));

		return this.wizardObject.open().then(() => {
			if (this.pages && this.pages.length > 0) {
				this.pages[0].onEnter();
			}
		});

	}

	protected abstract initialize(): void;
	protected abstract onOk(): void;
	protected abstract onCancel(): void;

	public addButton(button: azdata.window.Button) {
		this.customButtons.push(button);
	}

	protected setPages(pages: WizardPageBase<T>[]) {
		this.wizardObject!.pages = pages.map(p => p.pageObject);
		this.pages = pages;
		this.pages.forEach((page) => {
			page.initialize();
		});
	}

	private dispose() {
		let errorOccured = false;
		this.toDispose.forEach((disposable: vscode.Disposable) => {
			try {
				disposable.dispose();
			}
			catch (error) {
				errorOccured = true;
				console.error(error);
			}
		});

		if (errorOccured) {
			vscode.window.showErrorMessage(localize('resourceDeployment.DisposableError', "Error occured while closing the wizard: {0}, open 'Debugger Console' for more information."), this.title);
		}
	}

	public registerDisposable(disposable: vscode.Disposable): void {
		this.toDispose.push(disposable);
	}
}
