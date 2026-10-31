import { api } from '../../services/api.js';
import { withMediaAccessToken } from '../../services/mediaAccess.js';
import { ensureTenantSidebarStyles, loadTenantStylesheet, renderTenantSidebar } from './sidebarTenant.js';
import { createModal, openModal, successDialog } from '../../components/modal.js';
import { createPagination } from '../../components/pagination.js';

function parseViewingTime(value = '') {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value).trim());
	if (!match) return value ? null : '';
	const totalMinutes = Number(match[1]) * 60 + Number(match[2]);
	const isAvailable = (totalMinutes >= 480 && totalMinutes <= 660)
		|| (totalMinutes >= 720 && totalMinutes <= 960)
		|| (totalMinutes >= 1020 && totalMinutes <= 1140);
	return isAvailable ? `${match[1]}:${match[2]}` : null;
}

const FAVORITES_KEY = 'dormhive.favoriteListings';
const API_BASE = (window.DORMHIVE_API_URL ?? 'http://localhost:5000/api/v1').replace(/\/api\/v1\/?$/, '');
const FALLBACK_IMAGE = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" fill="#e8f0ed"/><path d="M0 370 230 160l180 170 120-110 270 230v70H0Z" fill="#c8dcd3"/><path d="M290 520V290l110-90 110 90v230" fill="#fff"/><path d="M365 520V365h75v155" fill="#9ab6aa"/></svg>');

const escapeHtml = (value = '') => {
	const element = document.createElement('span');
	element.textContent = String(value ?? '');
	return element.innerHTML;
};

function resolveImageUrl(value = '') {
	const image = String(value || '').trim();
	if (!image) return '';
	if (/^(data:|blob:)/i.test(image)) return image;
	const url = /^https?:\/\//i.test(image) ? image : `${API_BASE}${image.startsWith('/') ? '' : '/'}${image}`;
	return withMediaAccessToken(url);
}

function propertyImages(property = {}) {
	let uploaded = property.images;
	if (typeof uploaded === 'string') {
		try { uploaded = JSON.parse(uploaded); } catch { uploaded = [uploaded]; }
	}
	const gallery = Array.isArray(property.gallery) ? property.gallery : [];
	const sources = [property.image_url, property.cover_image, property.thumbnail, ...(Array.isArray(uploaded) ? uploaded : []), ...gallery]
		.map((image) => typeof image === 'string' ? image : image?.url || image?.image_url || '')
		.map(resolveImageUrl)
		.filter(Boolean);
	return [...new Set(sources)];
}

function roomType(property = {}) {
	const value = String(property.room_type ?? '').trim().toLowerCase();
	if (['private_room', 'solo_room', 'solo'].includes(value)) return 'Solo Room';
	if (['entire_unit', 'studio_unit', 'studio'].includes(value)) return 'Studio Unit';
	if (['bedspace', 'bed_space', 'shared_room'].includes(value)) return 'Bedspace';
	return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Room type not specified';
}

function hasAvailability(property = {}) {
	const availableSlots = Number(property.available_slots ?? property.total_slots ?? 0);
	return availableSlots > 0;
}

function readFavorites() {
	try {
		const values = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
		return new Set(Array.isArray(values) ? values.map(String) : []);
	} catch {
		return new Set();
	}
}

function listingAmenities(property = {}) {
	let amenities = property.amenities;
	if (typeof amenities === 'string') {
		try { amenities = JSON.parse(amenities); } catch { amenities = amenities.split(','); }
	}
	return Array.isArray(amenities) ? amenities.map((item) => String(item).replaceAll('_', ' ').trim()).filter(Boolean) : [];
}

function showListingDetails(property) {
	const images = propertyImages(property);
	const gallery = images.length ? images : [FALLBACK_IMAGE];
	const title = property.title || property.property_title || 'Property';
	const location = [property.address, property.barangay, property.municipality || property.city, property.province].filter(Boolean).join(', ') || 'Location not specified';
	const rent = Number(property.monthly_rent ?? property.rent ?? 0);
	const availableSlots = Number(property.available_slots ?? property.total_slots ?? 0);
	const amenities = listingAmenities(property);
	const modal = createModal({
		title,
		closeLabel: 'Close',
		content: `<div class="featured-listing-detail">
			<div class="featured-listing-detail__gallery">
				<div class="featured-listing-detail__stage">
					<img data-detail-image src="${escapeHtml(gallery[0])}" alt="${escapeHtml(title)} photo 1" />
					${gallery.length > 1 ? `<button type="button" data-detail-previous aria-label="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" data-detail-next aria-label="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button><span data-detail-count>1 / ${gallery.length}</span>` : ''}
				</div>
				${gallery.length > 1 ? `<nav class="featured-listing-detail__thumbnails" aria-label="Property photos">${gallery.map((image, index) => `<button type="button" data-detail-index="${index}" aria-label="View photo ${index + 1}" aria-current="${index === 0}"><img src="${escapeHtml(image)}" alt="" loading="lazy" /></button>`).join('')}</nav>` : ''}
			</div>
			<div class="featured-listing-detail__information">
				<div class="featured-listing-detail__price"><strong>PHP ${rent.toLocaleString('en-PH')}</strong><span>/ month</span></div>
				<p class="featured-listing-detail__location"><i class="bi bi-geo-alt" aria-hidden="true"></i>${escapeHtml(location)}</p>
				<dl>
					<div><dt>Room type</dt><dd>${escapeHtml(roomType(property))}</dd></div>
					<div><dt>Availability</dt><dd>${availableSlots > 0 ? `${availableSlots} slot${availableSlots === 1 ? '' : 's'} available` : 'Available'}</dd></div>
					<div><dt>Gender preference</dt><dd>${escapeHtml(property.gender_preference || 'Co-ed')}</dd></div>
					${property.owner_name ? `<div><dt>Owner</dt><dd>${escapeHtml(property.owner_name)}</dd></div>` : ''}
				</dl>
				<div class="featured-listing-detail__amenities"><h3>Amenities</h3>${amenities.length ? `<ul>${amenities.map((amenity) => `<li>${escapeHtml(amenity)}</li>`).join('')}</ul>` : '<p>No amenities listed.</p>'}</div>
				<div class="featured-listing-detail__description"><h3>About this property</h3><p>${escapeHtml(property.description || 'No description provided.')}</p></div>
			</div>
			<form class="featured-listing-request-form">
				<div class="featured-listing-request-form__heading"><h3>Rental Request Details</h3></div>
				<div class="featured-listing-request-form__fields">
					<label>Move-in Date<input type="date" name="moveInDate" required /></label>
					<label>Move-out Date<input type="date" name="moveOutDate" /><span class="featured-listing-request-form__indefinite"><input type="checkbox" name="isIndefiniteMoveOut" /><span>Indefinite / No planned move-out date</span></span></label>
					<label>Occupants (people)<input type="number" name="occupants" min="1" step="1" value="1" required /></label>
					<label>Viewing Date<input type="date" name="viewingDate" /></label>
					<label>Viewing Time<input type="time" name="viewingTime" value="08:00" min="08:00" max="19:00" step="1800" lang="en-US" /></label>
				</div>
				<div class="featured-listing-request-form__actions"><button type="button" data-chat-owner>Chat Owner</button><button type="submit" data-send-request>Send Request</button></div>
				<p class="featured-listing-request-form__status" role="status"></p>
			</form>
		</div>`
	});
	modal.classList.add('featured-listing-detail-modal');

	const image = modal.querySelector('[data-detail-image]');
	const count = modal.querySelector('[data-detail-count]');
	const thumbnails = Array.from(modal.querySelectorAll('[data-detail-index]'));
	let imageIndex = 0;
	const showImage = (nextIndex) => {
		imageIndex = (nextIndex + gallery.length) % gallery.length;
		image.src = gallery[imageIndex];
		image.alt = `${title} photo ${imageIndex + 1}`;
		if (count) count.textContent = `${imageIndex + 1} / ${gallery.length}`;
		thumbnails.forEach((thumbnail, index) => thumbnail.setAttribute('aria-current', String(index === imageIndex)));
	};
	const openPhotoViewer = () => {
		const viewer = document.createElement('dialog');
		viewer.className = 'featured-photo-viewer';
		viewer.setAttribute('aria-label', `${title} photos`);
		viewer.innerHTML = `<div class="featured-photo-viewer__stage"><img class="featured-photo-viewer__image" alt=""><button type="button" class="featured-photo-viewer__previous" aria-label="Previous photo" title="Previous photo"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" class="featured-photo-viewer__next" aria-label="Next photo" title="Next photo"><i class="bi bi-chevron-right" aria-hidden="true"></i></button><div class="featured-photo-viewer__actions"><button type="button" class="featured-photo-viewer__action featured-photo-viewer__download" aria-label="Download photo" title="Download photo"><i class="bi bi-download" aria-hidden="true"></i></button><button type="button" class="featured-photo-viewer__action featured-photo-viewer__share" aria-label="Share photo" title="Share photo"><i class="bi bi-share" aria-hidden="true"></i></button><button type="button" class="featured-photo-viewer__action featured-photo-viewer__close" aria-label="Close photo viewer" title="Close viewer"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div></div><nav class="featured-photo-viewer__thumbnails" aria-label="Property photos"></nav>`;
		const viewerImage = viewer.querySelector('.featured-photo-viewer__image');
		const viewerThumbnails = viewer.querySelector('.featured-photo-viewer__thumbnails');
		let viewerIndex = imageIndex;
		const thumbnailButtons = gallery.map((photo, index) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'featured-photo-viewer__thumbnail';
			button.setAttribute('aria-label', `View photo ${index + 1}`);
			button.setAttribute('aria-current', String(index === viewerIndex));
			const thumbnail = document.createElement('img');
			thumbnail.src = photo;
			thumbnail.alt = '';
			thumbnail.loading = 'lazy';
			button.append(thumbnail);
			viewerThumbnails.append(button);
			return button;
		});
		const renderViewerImage = () => {
			viewerImage.src = gallery[viewerIndex];
			viewerImage.alt = `${title} photo ${viewerIndex + 1}`;
			showImage(viewerIndex);
			thumbnailButtons.forEach((button, index) => {
				const isActive = index === viewerIndex;
				button.classList.toggle('is-active', isActive);
				button.setAttribute('aria-current', String(isActive));
			});
		};
		const moveViewer = (offset) => {
			viewerIndex = (viewerIndex + offset + gallery.length) % gallery.length;
			renderViewerImage();
		};
		const previousButton = viewer.querySelector('.featured-photo-viewer__previous');
		const nextButton = viewer.querySelector('.featured-photo-viewer__next');
		const closeButton = viewer.querySelector('.featured-photo-viewer__close');
		const downloadButton = viewer.querySelector('.featured-photo-viewer__download');
		const shareButton = viewer.querySelector('.featured-photo-viewer__share');
		previousButton.hidden = gallery.length < 2;
		nextButton.hidden = gallery.length < 2;
		previousButton.addEventListener('click', () => moveViewer(-1));
		nextButton.addEventListener('click', () => moveViewer(1));
		viewerThumbnails.addEventListener('click', (event) => {
			const thumbnail = event.target.closest('.featured-photo-viewer__thumbnail');
			if (!thumbnail) return;
			viewerIndex = Number(thumbnail.dataset.photoIndex);
			renderViewerImage();
		});
		closeButton.addEventListener('click', () => viewer.close());
		downloadButton.addEventListener('click', async () => {
			try {
				const response = await fetch(gallery[viewerIndex]);
				if (!response.ok) throw new Error('Download failed');
				const objectUrl = URL.createObjectURL(await response.blob());
				const link = document.createElement('a');
				link.href = objectUrl;
				link.download = `${String(title).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-photo-${viewerIndex + 1}`;
				link.click();
				setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
			} catch {
				window.open(gallery[viewerIndex], '_blank', 'noopener,noreferrer');
			}
		});
		shareButton.addEventListener('click', async () => {
			try {
				if (navigator.share) await navigator.share({ title: `${title} photo`, url: gallery[viewerIndex] });
				else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(gallery[viewerIndex]);
				else window.open(gallery[viewerIndex], '_blank', 'noopener,noreferrer');
			} catch (error) {
				if (error.name !== 'AbortError') window.open(gallery[viewerIndex], '_blank', 'noopener,noreferrer');
			}
		});
		viewer.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowLeft' && gallery.length > 1) moveViewer(-1);
			if (event.key === 'ArrowRight' && gallery.length > 1) moveViewer(1);
		});
		viewer.addEventListener('click', (event) => {
			if (event.target === viewer) viewer.close();
		});
		viewer.addEventListener('close', () => viewer.remove(), { once: true });
		renderViewerImage();
		document.body.append(viewer);
		viewer.showModal();
		closeButton.focus();
	};
	image.tabIndex = 0;
	image.setAttribute('role', 'button');
	image.setAttribute('aria-label', `View ${title} photo larger`);
	image.addEventListener('click', openPhotoViewer);
	image.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openPhotoViewer();
		}
	});
	modal.querySelector('[data-detail-previous]')?.addEventListener('click', () => showImage(imageIndex - 1));
	modal.querySelector('[data-detail-next]')?.addEventListener('click', () => showImage(imageIndex + 1));
	modal.querySelector('.featured-listing-detail__thumbnails')?.addEventListener('click', (event) => {
		const thumbnail = event.target.closest('[data-detail-index]');
		if (thumbnail) showImage(Number(thumbnail.dataset.detailIndex));
	});
	const form = modal.querySelector('.featured-listing-request-form');
	const status = form.querySelector('.featured-listing-request-form__status');
	const moveIn = form.querySelector('[name="moveInDate"]');
	const moveOut = form.querySelector('[name="moveOutDate"]');
	const indefiniteMoveOut = form.querySelector('[name="isIndefiniteMoveOut"]');
	moveIn.min = new Date().toISOString().split('T')[0];
	const updateMoveOutMinimum = () => {
		if (!moveIn.value) {
			moveOut.removeAttribute('min');
			return;
		}
		const firstValidMoveOut = new Date(`${moveIn.value}T00:00:00`);
		firstValidMoveOut.setDate(firstValidMoveOut.getDate() + 1);
		moveOut.min = `${firstValidMoveOut.getFullYear()}-${String(firstValidMoveOut.getMonth() + 1).padStart(2, '0')}-${String(firstValidMoveOut.getDate()).padStart(2, '0')}`;
	};
	updateMoveOutMinimum();
	moveIn.addEventListener('change', updateMoveOutMinimum);
	indefiniteMoveOut.addEventListener('change', () => {
		moveOut.disabled = indefiniteMoveOut.checked;
		if (indefiniteMoveOut.checked) moveOut.value = '';
	});
	modal.querySelector('[data-chat-owner]').addEventListener('click', () => {
		const chatUrl = new URL(window.location.href);
		chatUrl.hash = `/tenant/message?propertyId=${encodeURIComponent(property.id)}`;
		const chatWindow = window.open(chatUrl.href, '_blank', 'noopener,noreferrer');
		if (chatWindow) chatWindow.opener = null;
	});
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!form.reportValidity()) return;
		if (!indefiniteMoveOut.checked && moveOut.value && moveIn.value && moveOut.value <= moveIn.value) {
			status.textContent = 'Move-out date must be after the move-in date.';
			return;
		}
		const viewingDate = form.querySelector('[name="viewingDate"]').value.trim();
		const rawViewingTime = form.querySelector('[name="viewingTime"]').value;
		const viewingTime = viewingDate && rawViewingTime ? parseViewingTime(rawViewingTime) : '';
		if (viewingTime === null) {
			status.textContent = 'Select a viewing time between 8 AM and 7 PM.';
			return;
		}
		if (Boolean(viewingDate) !== Boolean(viewingTime)) {
			status.textContent = 'Select both a viewing date and time, or leave both blank.';
			return;
		}
		const submitButton = form.querySelector('[data-send-request]');
		submitButton.disabled = true;
		try {
			await api.bookings.create({
				propertyId: Number(property.id),
				moveInDate: moveIn.value,
				moveOutDate: indefiniteMoveOut.checked ? null : moveOut.value || null,
				isIndefiniteMoveOut: indefiniteMoveOut.checked,
				viewingDate: viewingDate || null,
				viewingTime: viewingTime || null,
				occupants: Number(form.querySelector('[name="occupants"]').value || 1),
				message: ''
			});
			modal.close();
			await successDialog('Booking request sent successfully.');
		} catch (error) {
			status.textContent = error.message || 'Unable to submit booking request.';
			submitButton.disabled = false;
		}
	});
	openModal(modal);
}

function renderCard(property, favorites) {
	const id = String(property.id ?? '');
	const title = property.title || property.property_title || 'Property';
	const images = propertyImages(property);
	const image = images[0] || FALLBACK_IMAGE;
	const location = [property.barangay, property.municipality || property.city, property.province].filter(Boolean).join(', ') || property.address || 'Location not specified';
	const price = Number(property.monthly_rent ?? property.rent ?? 0);
	const isFavorite = favorites.has(id);
	const capacity = Number(property.available_slots ?? property.total_slots ?? 0);

	return `<article class="featured-listing" data-listing-id="${escapeHtml(id)}">
		<div class="featured-listing__media">
			<button class="featured-listing__image-button" type="button" data-open-listing="${escapeHtml(id)}" aria-label="View details for ${escapeHtml(title)}">
				<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" />
			</button>
			<span class="featured-listing__availability"><span aria-hidden="true"></span> Available</span>
			<button class="featured-listing__favorite${isFavorite ? ' is-favorite' : ''}" type="button" data-favorite="${escapeHtml(id)}" aria-label="${isFavorite ? 'Remove from favorites' : 'Save listing'}" aria-pressed="${isFavorite}" title="${isFavorite ? 'Remove from favorites' : 'Save listing'}">
				<i class="bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i>
			</button>
			${images.length > 1 ? `<span class="featured-listing__photo-count"><i class="bi bi-images" aria-hidden="true"></i> ${images.length}</span>` : ''}
		</div>
		<div class="featured-listing__content">
			<div class="featured-listing__eyebrow"><span>${escapeHtml(roomType(property))}</span><span>${escapeHtml(property.gender_preference || 'Co-ed')}</span></div>
			<h2>${escapeHtml(title)}</h2>
			<p class="featured-listing__location"><i class="bi bi-geo-alt" aria-hidden="true"></i>${escapeHtml(location)}</p>
			<div class="featured-listing__footer">
				<p class="featured-listing__price"><strong>PHP ${price.toLocaleString('en-PH')}</strong><span>/ month</span></p>
				<span class="featured-listing__capacity">${capacity > 0 ? `${capacity} slot${capacity === 1 ? '' : 's'}` : 'Open availability'}</span>
			</div>
			<button class="featured-listing__details" type="button" data-open-listing="${escapeHtml(id)}">View Details <i class="bi bi-arrow-up-right" aria-hidden="true"></i></button>
		</div>
	</article>`;
}

export async function renderFeaturedListings(root = document.querySelector('#app')) {
	if (!root) throw new Error('Featured listings page requires #app.');
	const stylesheet = new URL('./style/featuredListings.css', import.meta.url);
	stylesheet.searchParams.set('v', 'featured-photo-viewer-actions-1');
	await Promise.all([
		ensureTenantSidebarStyles(),
		loadTenantStylesheet('featured-listings', stylesheet)
	]);

	root.innerHTML = `<div class="dh-app dh-featured-list-page">
		${renderTenantSidebar('featuredListings')}
		<main class="featured-listings-main">
			<header class="featured-listings-heading">
				<div><p class="featured-listings-kicker">PROPERTY DISCOVERY</p><h1>Featured Listings</h1><p>Browse approved homes with space available.</p></div>
				<div class="featured-listings-total"><strong data-featured-total>0</strong><span>available listings</span></div>
			</header>
			<section class="featured-listings-controls" aria-label="Filter featured listings">
				<label class="featured-listings-search"><span>Search listings</span><span class="featured-listings-search__field"><i class="bi bi-search" aria-hidden="true"></i><input type="search" data-featured-search placeholder="Property, location, or keyword"></span></label>
				<label><span>Room type</span><select data-featured-room><option value="all">All room types</option><option value="Solo Room">Solo Room</option><option value="Studio Unit">Studio Unit</option><option value="Bedspace">Bedspace</option><option value="other">Other</option></select></label>
				<label><span>Sort by</span><select data-featured-sort><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
				<button class="featured-listings-clear" type="button" data-featured-clear>Clear</button>
			</section>
			<p class="featured-listings-status" data-featured-status role="status" aria-live="polite">Loading listings...</p>
			<section class="featured-listings-grid" data-featured-grid aria-label="Available featured listings"></section>
			<div class="featured-listings-pagination" data-featured-pagination></div>
		</main>
	</div>`;

	const grid = root.querySelector('[data-featured-grid]');
	const status = root.querySelector('[data-featured-status]');
	const total = root.querySelector('[data-featured-total]');
	const search = root.querySelector('[data-featured-search]');
	const roomSelect = root.querySelector('[data-featured-room]');
	const sortSelect = root.querySelector('[data-featured-sort]');
	const pageSize = 6;
	let currentPage = 1;
	let listings = [];
	const pagination = createPagination({
		page: currentPage,
		total: 0,
		limit: pageSize,
		onChange: (page) => {
			currentPage = page;
			renderListings();
			grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	});
	root.querySelector('[data-featured-pagination]').append(pagination.element);

	const renderListings = () => {
		const query = search.value.trim().toLowerCase();
		const roomFilter = roomSelect.value;
		const visible = listings.filter((property) => {
			const text = [property.title, property.property_title, property.description, property.address, property.barangay, property.municipality, property.city, property.province, roomType(property)].filter(Boolean).join(' ').toLowerCase();
			const propertyRoomType = roomType(property);
			const isStandardRoomType = ['Solo Room', 'Studio Unit', 'Bedspace'].includes(propertyRoomType);
			const matchesRoomType = roomFilter === 'all'
				|| (roomFilter === 'other' ? !isStandardRoomType : propertyRoomType === roomFilter);
			return (!query || text.includes(query)) && matchesRoomType;
		});

		if (sortSelect.value === 'price-low') visible.sort((a, b) => Number(a.monthly_rent ?? a.rent ?? 0) - Number(b.monthly_rent ?? b.rent ?? 0));
		if (sortSelect.value === 'price-high') visible.sort((a, b) => Number(b.monthly_rent ?? b.rent ?? 0) - Number(a.monthly_rent ?? a.rent ?? 0));

		total.textContent = String(visible.length);
		status.textContent = visible.length ? `${visible.length} available ${visible.length === 1 ? 'listing' : 'listings'}` : 'No listings match these filters.';
		const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
		currentPage = Math.min(currentPage, pageCount);
		const start = (currentPage - 1) * pageSize;
		grid.innerHTML = visible.slice(start, start + pageSize).map((property) => renderCard(property, readFavorites())).join('');
		pagination.update({ page: currentPage, total: visible.length, limit: pageSize });
	};

	const resetPageAndRender = () => {
		currentPage = 1;
		renderListings();
	};
	search.addEventListener('input', resetPageAndRender);
	roomSelect.addEventListener('change', resetPageAndRender);
	sortSelect.addEventListener('change', resetPageAndRender);
	root.querySelector('[data-featured-clear]').addEventListener('click', () => {
		search.value = '';
		roomSelect.value = 'all';
		sortSelect.value = 'recommended';
		resetPageAndRender();
		search.focus();
	});

	grid.addEventListener('click', (event) => {
		const favoriteButton = event.target.closest('[data-favorite]');
		if (favoriteButton) {
			const favorites = readFavorites();
			const id = favoriteButton.dataset.favorite;
			if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
			localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
			const isFavorite = favorites.has(id);
			favoriteButton.classList.toggle('is-favorite', isFavorite);
			favoriteButton.setAttribute('aria-pressed', String(isFavorite));
			favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Save listing');
			favoriteButton.title = isFavorite ? 'Remove from favorites' : 'Save listing';
			favoriteButton.innerHTML = `<i class="bi ${isFavorite ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i>`;
			return;
		}
		const detailsButton = event.target.closest('[data-open-listing]');
		if (detailsButton) {
			const property = listings.find((item) => String(item.id) === detailsButton.dataset.openListing);
			if (property) showListingDetails(property);
		}
	});

	try {
		const response = await api.listings.list({ limit: 100, status: 'approved' });
		listings = (Array.isArray(response?.data) ? response.data : []).filter(hasAvailability);
		renderListings();
	} catch (error) {
		total.textContent = '0';
		status.textContent = error.message || 'Unable to load listings.';
		grid.innerHTML = '<button class="featured-listings-retry" type="button" data-featured-retry>Try again</button>';
		grid.querySelector('[data-featured-retry]').addEventListener('click', () => renderFeaturedListings(root));
	}
}
