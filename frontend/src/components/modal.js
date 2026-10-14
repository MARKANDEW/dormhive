let stylesheetPromise;
function style() {
	if (stylesheetPromise) return stylesheetPromise;
	let link = document.querySelector('[data-component-style="modal"]');
	const href = new URL('./style/modal.css', import.meta.url);
	href.searchParams.set('v', 'centered-confirm-1');
	if (!link) {
		link = document.createElement('link');
		link.rel = 'stylesheet';
		link.dataset.componentStyle = 'modal';
	}
	if (link.href !== href.href) link.href = href.href;
	stylesheetPromise = new Promise(resolve => {
		if (link.sheet) {
			resolve();
			return;
		}
		link.addEventListener('load', resolve, { once: true });
		link.addEventListener('error', resolve, { once: true });
		if (!link.isConnected) document.head.append(link);
	});
	return stylesheetPromise;
}

export function createModal({ title = '', content = '', closeLabel = 'Close', footerMarkup = '' } = {}) {
	style();
	document.querySelectorAll('.ui-modal').forEach((existing) => existing.remove());
	const dialog = document.createElement('dialog');
	dialog.className = 'ui-modal';
	dialog.innerHTML = `<div class="ui-modal__header"><h2>${title}</h2><button type="button" aria-label="Close dialog" data-modal-close>×</button></div><div class="ui-modal__body"></div><div class="ui-modal__footer">${footerMarkup}<button type="button" data-modal-close>${closeLabel}</button></div>`;
	const body = dialog.querySelector('.ui-modal__body');
	typeof content === 'string' ? body.innerHTML = content : body.append(content);
	let closing = false;
	const remove = () => {
		window.removeEventListener('hashchange', close);
		dialog.remove();
	};
	const close = () => {
		if (closing) return;
		closing = true;
		if (dialog.open) dialog.close();
		remove();
	};
	dialog.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', close));
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) close();
	});
	dialog.addEventListener('close', remove, { once: true });
	window.addEventListener('hashchange', close);
	document.body.append(dialog);
	return dialog;
}

export function openModal(modal) {
	return style().then(() => {
		if (modal.isConnected && !modal.open) modal.showModal();
		return modal;
	});
}

export async function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
	const content = document.createElement('div');
	content.className = 'ui-confirm-dialog__content';
	const icon = document.createElement('span');
	icon.className = 'ui-confirm-dialog__icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.innerHTML = '<i class="bi bi-archive"></i>';
	const description = document.createElement('p');
	description.textContent = message;
	content.append(icon, description);

	const confirmButton = document.createElement('button');
	confirmButton.type = 'button';
	confirmButton.className = 'ui-confirm-dialog__confirm';
	confirmButton.textContent = confirmLabel;
	const modal = createModal({
		title: escapeHtml(title),
		content,
		closeLabel: escapeHtml(cancelLabel),
		footerMarkup: confirmButton.outerHTML
	});
	modal.classList.add('ui-confirm-dialog');

	const result = new Promise((resolve) => {
		modal.addEventListener('close', () => resolve(modal.returnValue === 'confirm'), { once: true });
		modal.querySelector('.ui-confirm-dialog__confirm').addEventListener('click', () => modal.close('confirm'));
	});
	await openModal(modal);
	modal.querySelector('[data-modal-close]:not([aria-label])')?.focus();
	return result;
}

function escapeHtml(value) {
	const element = document.createElement('span');
	element.textContent = value;
	return element.innerHTML;
}
