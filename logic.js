import closetDB from './indexeddb.js';

document.addEventListener('DOMContentLoaded', () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('SW Registered', reg))
                .catch(err => console.log('SW Failed', err));
        });
    }

    // State management
    let inventory = [];
    let isEditing = false;
    let currentStream = null;
    let searchTimeout; // For debouncing search

    // DOM Elements
    const inventoryGrid = document.getElementById('inventoryGrid');
    const itemModal = document.getElementById('itemModal');
    const itemForm = document.getElementById('itemForm');
    const openAddModal = document.getElementById('openAddModal');
    const mobileAddBtn = document.getElementById('mobileAddBtn'); // New mobile FAB
    const closeModal = document.getElementById('closeModal');
    const searchInput = document.getElementById('searchInput');
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const previewText = document.getElementById('previewText');
    const triggerCamera = document.getElementById('triggerCamera');
    const cameraOverlay = document.getElementById('cameraOverlay');
    const video = document.getElementById('video');
    const snap = document.getElementById('snap');
    const cancelCamera = document.getElementById('cancelCamera');
    const cancelForm = document.getElementById('cancelForm');
    const searchBtn = document.getElementById('searchBtn');

    // View Modal Elements
    const viewModal = document.getElementById('viewModal');
    const closeViewModal = document.getElementById('closeViewModal');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const editFromView = document.getElementById('editFromView');
    let viewCurrentId = null;

    // Filter Elements
    const filterSex = document.getElementById('filterSex');
    const filterType = document.getElementById('filterType');
    const filterSize = document.getElementById('filterSize');
    const filterBrand = document.getElementById('filterBrand');
    const filterColor = document.getElementById('filterColor');
    const filterSeason = document.getElementById('filterSeason');
    const filterOccasion = document.getElementById('filterOccasion');
    const filterMaterial = document.getElementById('filterMaterial');
    const filterOwned = document.getElementById('filterOwned');
    const resetFilters = document.getElementById('resetFilters');

    // --- Utility Functions ---

    // Sanitize HTML to prevent XSS
    function sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Debounce function for search
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Core Functions ---

    async function loadInventory() {
        try {
            inventory = await closetDB.getAllItems();
            updateFilterOptions();
            applyFilters();
        } catch (error) {
            console.error('Error loading inventory:', error);
            showAlert('Failed to load data. Please try again.', 'error');
        }
    }

    async function saveInventory() {
        try {
            updateFilterOptions();
            applyFilters();
        } catch (error) {
            console.error('Error saving inventory:', error);
            showAlert('Failed to save data. Please try again.', 'error');
        }
    }

    function showAlert(message, type = 'info') {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'error' ? '#ff6b6b' : type === 'success' ? '#51cf66' : '#cbb26a'};
            color: white;
            border-radius: 12px;
            z-index: 9999;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            font-size: 14px;
            max-width: 320px;
            white-space: pre-wrap;
            border: 1px solid rgba(255,255,255,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        alertDiv.textContent = message;

        document.body.appendChild(alertDiv);

        // Remove after 3 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 3000);
    }

    // Enhanced filter function with debouncing
    const applyFilters = debounce(function () {
        try {
            const query = searchInput.value.toLowerCase().trim();

            const activeSex = Array.from(filterSex.querySelectorAll('input:checked')).map(i => i.value);
            const activeTypes = Array.from(filterType.querySelectorAll('input:checked')).map(i => i.value);
            const activeSizes = Array.from(filterSize.querySelectorAll('input:checked')).map(i => i.value);
            const activeBrands = Array.from(filterBrand.querySelectorAll('input:checked')).map(i => i.value);
            const activeColors = Array.from(filterColor.querySelectorAll('input:checked')).map(i => i.value);
            const activeSeasons = Array.from(filterSeason.querySelectorAll('input:checked')).map(i => i.value);
            const activeOccasions = Array.from(filterOccasion.querySelectorAll('input:checked')).map(i => i.value);
            const activeMaterials = Array.from(filterMaterial.querySelectorAll('input:checked')).map(i => i.value);
            const activeOwned = Array.from(filterOwned.querySelectorAll('input:checked')).map(i => i.value);

            console.log('Active Filters:', {
                query, activeSex, activeTypes, activeSizes, activeBrands, activeColors, activeSeasons, activeOccasions, activeMaterials, activeOwned
            });

            const filtered = inventory.filter(item => {
                const matchesSearch = item.name.toLowerCase().includes(query) ||
                    (item.brand || '').toLowerCase().includes(query) ||
                    (item.type || '').toLowerCase().includes(query) ||
                    (item.color || '').toLowerCase().includes(query) ||
                    (item.material || '').toLowerCase().includes(query) ||
                    (item.description || '').toLowerCase().includes(query);

                const matchesSex = activeSex.length === 0 || activeSex.includes(item.sex);
                const matchesType = activeTypes.length === 0 || activeTypes.includes(item.type);
                const matchesSize = activeSizes.length === 0 || activeSizes.includes(item.size);
                const matchesBrand = activeBrands.length === 0 || activeBrands.includes(item.brand);
                const matchesColor = activeColors.length === 0 || activeColors.includes(item.color);
                const matchesSeason = activeSeasons.length === 0 || activeSeasons.includes(item.season);
                const matchesOccasion = activeOccasions.length === 0 || activeOccasions.includes(item.occasion);
                const matchesMaterial = activeMaterials.length === 0 || activeMaterials.includes(item.material);
                const matchesOwned = activeOwned.length === 0 || activeOwned.includes(item.stillOwned);

                return matchesSearch && matchesSex && matchesType && matchesSize &&
                    matchesBrand && matchesColor && matchesSeason &&
                    matchesOccasion && matchesMaterial && matchesOwned;
            });

            console.log(`Filtered down to ${filtered.length} items.`);
            renderInventory(filtered);
        } catch (error) {
            console.error('Error applying filters:', error);
            showAlert('Error filtering items. Please try again.', 'error');
        }
    }, 300); // 300ms delay

    function updateFilterOptions() {
        console.log("Updating filter options...");
        const populateDynamicFilter = (container, field) => {
            if (!container) return;
            const values = [...new Set(inventory.map(i => i[field]))]
                .filter(v => v && v.trim() !== '')
                .sort();

            if (values.length === 0) {
                container.innerHTML = `
                    <div class="filter-option" style="color: var(--primary); font-style: italic; opacity: 0.6; padding: 0.2rem 0;">
                        (All / No values set)
                    </div>
                `;
                return;
            }

            const currentChecked = Array.from(container.querySelectorAll('input:checked')).map(i => i.value);
            container.innerHTML = values.map(val => `
                <label class="filter-option">
                    <input type="checkbox" value="${sanitizeHTML(val)}" ${currentChecked.includes(val) ? 'checked' : ''}> ${sanitizeHTML(val)}
                </label>
            `).join('');
        };

        populateDynamicFilter(filterSize, 'size');
        populateDynamicFilter(filterBrand, 'brand');
        populateDynamicFilter(filterColor, 'color');
        populateDynamicFilter(filterMaterial, 'material');
    }

    async function renderInventory(filteredData = null) {
        try {
            const dataToShow = filteredData || inventory;
            const countEl = document.getElementById('itemCount');
            if (countEl) countEl.innerText = `${dataToShow.length} Items Found`;

            if (dataToShow.length === 0) {
                inventoryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No items match your filters.</div>';
                return;
            }

            // Build HTML for items
            let inventoryHTML = '';
            for (const item of dataToShow) {
                // Create safe HTML for each item
                const itemHTML = `
                    <div class="item-card" data-id="${sanitizeHTML(item.id)}">
                        <div class="item-owned ${item.stillOwned === 'y' ? 'yes' : 'no'}">
                            ${item.stillOwned === 'y' ? 'OWNED' : 'GONE'}
                        </div>
                        <div class="item-image-placeholder" style="width:100%; height:180px; background:#1e2023; display:flex; align-items:center; justify-content:center; cursor:pointer;" onclick="viewItem('${sanitizeHTML(item.id)}')">
                            ${item.hasPhoto ?
                        '<div style="color:#666;">Photo Loading...</div>' :
                        '<div style="color:#666;">📷 No Photo</div>'}
                        </div>
                        <div class="item-info">
                            <div class="item-type">${sanitizeHTML(item.type)}</div>
                            <div class="item-name" onclick="viewItem('${sanitizeHTML(item.id)}')" style="cursor: pointer">${sanitizeHTML(item.name)}</div>
                            <div class="item-tags">
                                ${item.brand ? `<span class="tag">B: ${sanitizeHTML(item.brand)}</span>` : ''}
                                ${item.size ? `<span class="tag">S: ${sanitizeHTML(item.size)}</span>` : ''}
                                ${item.color ? `<span class="tag">C: ${sanitizeHTML(item.color)}</span>` : ''}
                            </div>
                            <div class="item-actions">
                                <button onclick="editItem('${sanitizeHTML(item.id)}')" class="btn-icon" title="Edit">✎</button>
                                <button onclick="deleteItem('${sanitizeHTML(item.id)}')" class="btn-icon" title="Delete" style="color: #ff6b6b">🗑</button>
                            </div>
                        </div>
                    </div>`;
                inventoryHTML += itemHTML;
            }

            inventoryGrid.innerHTML = inventoryHTML;

            // Track this render to prevent race conditions
            const renderId = Date.now();
            inventoryGrid.dataset.renderId = renderId;

            // Load actual images in parallel (but with a slight delay to allow UI to breathe)
            dataToShow.forEach(async (item) => {
                if (item.hasPhoto) {
                    try {
                        const blob = await closetDB.getPhotoBlob(item.id);
                        // Check if we are still on the same render
                        if (inventoryGrid.dataset.renderId != renderId) return;

                        if (blob) {
                            const imageUrl = URL.createObjectURL(blob);
                            const imgPlaceholder = document.querySelector(`.item-card[data-id="${item.id}"] .item-image-placeholder`);
                            if (imgPlaceholder) {
                                imgPlaceholder.innerHTML = `<img src="${imageUrl}" alt="${item.name}" style="width:100%; height:100%; object-fit:cover;">`;
                                // Clean up URL object when image is loaded
                                const img = imgPlaceholder.querySelector('img');
                                img.addEventListener('load', () => {
                                    // We can't revoke immediately if we want to support browser cache/redraws 
                                    // but for this app's simple lifecycle it should be okay. 
                                    // Alternatively, we could keep a list of URLs to revoke on next render.
                                });
                            }
                        }
                    } catch (imgError) {
                        console.error('Error loading image for item:', item.id, imgError);
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering inventory:', error);
            inventoryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Error loading items. Please try refreshing.</div>';
        }
    }

    // --- Input Validation ---

    function validateItemForm() {
        const itemName = document.getElementById('itemName').value.trim();
        const itemType = document.getElementById('itemType').value;

        if (!itemName) {
            showAlert('Item name is required', 'error');
            return false;
        }

        if (!itemType) {
            showAlert('Please select an item type', 'error');
            return false;
        }

        return true;
    }

    // --- Event Listeners ---

    // Modal Control
    // Exposed Global Actions
    window.handleOpenAddModal = function () {
        try {
            console.log('Open Add Modal Triggered');
            const itemModalEl = document.getElementById('itemModal'); // Get fresh reference
            if (!itemModalEl) {
                showAlert('Error: Modal not found!', 'error');
                return;
            }

            isEditing = false;
            // Ensure itemForm exists
            const formEl = document.getElementById('itemForm');
            if (formEl) formEl.reset();

            const idEl = document.getElementById('itemId');
            if (idEl) idEl.value = '';

            const titleEl = document.getElementById('modalTitle');
            if (titleEl) titleEl.innerText = 'New Addition';

            const pImg = document.getElementById('previewImg');
            if (pImg) {
                pImg.style.display = 'none';
                pImg.src = '';
            }

            const pTxt = document.getElementById('previewText');
            if (pTxt) pTxt.style.display = 'block';

            itemModalEl.style.display = 'flex';
            hideFab(); // Hide FAB when modal opens
        } catch (e) {
            console.error('Error opening modal:', e);
            showAlert('Error opening modal: ' + e.message, 'error');
        }
    };

    // Helper functions to hide/show FAB
    function hideFab() {
        const fab = document.getElementById('mobileAddBtn');
        if (fab) fab.style.display = 'none';
    }

    function showFab() {
        // Only show on mobile
        if (window.innerWidth <= 768) {
            const fab = document.getElementById('mobileAddBtn');
            if (fab) fab.style.display = 'flex';
        }
    }

    closeModal.onclick = () => {
        itemModal.style.display = 'none';
        stopCamera();
        showFab(); // Show FAB when modal closes
        // Clear preview
        if (previewImg) previewImg.src = '';
    };

    closeViewModal.onclick = () => {
        viewModal.style.display = 'none';
        showFab();
    };
    closeViewBtn.onclick = () => {
        viewModal.style.display = 'none';
        showFab();
    };

    editFromView.onclick = () => {
        viewModal.style.display = 'none';
        editItem(viewCurrentId);
    };

    cancelForm.onclick = () => {
        itemModal.style.display = 'none';
        stopCamera();
        showFab(); // Show FAB when modal closes
        // Clear preview
        if (previewImg) previewImg.src = '';
    };

    // Search Functionality with debouncing
    searchInput.oninput = () => {
        applyFilters();
    };

    searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            applyFilters();
            searchInput.blur();
        }
    };

    searchBtn.onclick = () => {
        applyFilters();
    };

    // Filter Event Listeners
    [filterSex, filterType, filterSize, filterBrand, filterColor, filterSeason, filterOccasion, filterMaterial, filterOwned].forEach(el => {
        if (el) {
            el.onchange = () => {
                applyFilters();
            };
        }
    });

    resetFilters.onclick = () => {
        document.querySelectorAll('.sidebar input[type="checkbox"]').forEach(i => i.checked = false);
        searchInput.value = '';
        applyFilters();
    };

    // Collapsible Filters Logic
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.filter-section h3');
        if (header) {
            header.parentElement.classList.toggle('collapsed');
        }

        // Pancake Menu Toggle
        const menuBtn = document.getElementById('pancakeMenuBtn');
        const dropdown = document.getElementById('pancakeDropdown');

        if (e.target === menuBtn) {
            const isOpening = !dropdown.classList.contains('show');
            dropdown.classList.toggle('show');
            if (isOpening) {
                dropdown.classList.remove('expanded');
                document.querySelectorAll('.side-content').forEach(c => c.classList.remove('active'));
            }
        } else if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            dropdown.classList.remove('expanded');
            document.querySelectorAll('.side-content').forEach(c => c.classList.remove('active'));
        }
    });

    // Pancake Menu Actions
    function showSidePanel(panelId) {
        const dropdown = document.getElementById('pancakeDropdown');
        const contents = document.querySelectorAll('.side-content');

        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(panelId).classList.add('active');
        dropdown.classList.add('expanded');
    }

    document.getElementById('menuSupport').onclick = (e) => {
        e.preventDefault();
        showSidePanel('supportContent');
    };

    document.getElementById('menuAbout').onclick = (e) => {
        e.preventDefault();
        showSidePanel('aboutContent');
    };

    // Enter key navigation for form
    itemForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = e.target;

            // Allow default interaction for textareas (new lines)
            if (target.tagName === 'TEXTAREA') return;

            // If we are on the submit button, let the form submit naturally
            if (target.type === 'submit') return;

            // Prevent default form submission for other fields
            e.preventDefault();

            // Find all visible focusable fields + submit button
            // Filter out hidden inputs (like file inputs) by checking offsetParent
            const inputs = Array.from(itemForm.querySelectorAll('input:not([type="hidden"]), select, textarea, button[type="submit"]'))
                .filter(el => el.offsetParent !== null && !el.disabled);

            const index = inputs.indexOf(target);

            if (index > -1 && index < inputs.length - 1) {
                // Move focus to next field
                inputs[index + 1].focus();
            }
        }
    });

    // Form Submission with validation
    itemForm.onsubmit = async (e) => {
        e.preventDefault();

        if (!validateItemForm()) {
            return;
        }

        try {
            const formData = {
                id: document.getElementById('itemId').value || Date.now().toString(),
                name: document.getElementById('itemName').value.trim(),
                type: document.getElementById('itemType').value,
                brand: document.getElementById('itemBrand').value.trim(),
                color: document.getElementById('itemColor').value.trim(),
                season: document.getElementById('itemSeason').value,
                occasion: document.getElementById('itemOccasion').value,
                material: document.getElementById('itemMaterial').value.trim(),
                boughtFrom: document.getElementById('itemBoughtFrom').value.trim(),
                description: document.getElementById('itemDescription').value.trim(),
                size: document.getElementById('itemSize').value.trim(),
                date: document.getElementById('purchaseDate').value,
                amount: document.getElementById('purchaseAmount').value,
                sex: document.getElementById('itemSex').value,
                stillOwned: document.getElementById('stillOwned').value
            };

            // Get photo blob only if it's a NEW photo (data: URL)
            // Existing photos (blob: URLs) are already in the DB
            let photoBlob = null;
            if (previewImg.style.display !== 'none' && previewImg.src) {
                if (previewImg.src.startsWith('data:')) {
                    const response = await fetch(previewImg.src);
                    photoBlob = await response.blob();
                }
            }

            // saveItem handles both Insert and Update (using .put)
            // If photoBlob is null, it preserves the existing photo in the DB
            await closetDB.saveItem(formData, photoBlob);

            await loadInventory();
            itemModal.style.display = 'none';
            showAlert(isEditing ? 'Item updated successfully!' : 'Item added successfully!', 'success');
        } catch (error) {
            console.error('Error saving item:', error);
            showAlert('Failed to save item. Please try again.', 'error');
        }
    };

    // Image Handling
    imagePreview.onclick = () => imageInput.click();

    function handleFile(file) {
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showAlert('Please select an image file', 'error');
                return;
            }

            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showAlert('Image size should be less than 5MB', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (re) => {
                previewImg.src = re.target.result;
                previewImg.style.display = 'block';
                previewText.style.display = 'none';
            };
            reader.onerror = () => {
                showAlert('Error reading file. Please try another image.', 'error');
            };
            reader.readAsDataURL(file);
        }
    }

    imageInput.onchange = (e) => {
        handleFile(e.target.files[0]);
    };

    // Camera API
    triggerCamera.onclick = async () => {
        // Check if we're on a secure context (HTTPS or localhost)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            const useFilePicker = confirm(
                "Camera access requires HTTPS (secure connection).\n\n" +
                "You're currently on HTTP, so the camera is blocked by your browser.\n\n" +
                "Would you like to select a photo from your gallery instead?"
            );
            if (useFilePicker) {
                imageInput.click();
            }
            return;
        }

        try {
            currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = currentStream;
            cameraOverlay.style.display = 'flex';
        } catch (err) {
            console.error('Camera error:', err);
            const useFilePicker = confirm(
                "Could not access camera: " + err.message + "\n\n" +
                "Would you like to select a photo from your gallery instead?"
            );
            if (useFilePicker) {
                imageInput.click();
            } else {
                showAlert('Camera access denied. Please check your browser permissions.', 'error');
            }
        }
    };

    snap.onclick = () => {
        try {
            const canvas = document.getElementById('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
            previewText.style.display = 'none';
            cameraOverlay.style.display = 'none';
            stopCamera();
        } catch (error) {
            console.error('Error capturing image:', error);
            showAlert('Error capturing image. Please try again.', 'error');
        }
    };

    cancelCamera.onclick = () => {
        cameraOverlay.style.display = 'none';
        stopCamera();
    };

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    // Exposed Global Actions
    window.deleteItem = async (id) => {
        try {
            if (confirm('Verify: Permanently remove this item from your closet?')) {
                await closetDB.deleteItem(id);
                await loadInventory();
                showAlert('Item deleted successfully!', 'success');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showAlert('Failed to delete item. Please try again.', 'error');
        }
    };

    window.editItem = async (id) => {
        try {
            const item = await closetDB.getItem(id);
            if (!item) {
                showAlert('Item not found', 'error');
                return;
            }

            isEditing = true;
            document.getElementById('itemId').value = item.id;
            document.getElementById('itemName').value = item.name;
            document.getElementById('itemType').value = item.type;
            document.getElementById('itemBrand').value = item.brand || '';
            document.getElementById('itemColor').value = item.color || '';
            document.getElementById('itemSeason').value = item.season || 'all';
            document.getElementById('itemOccasion').value = item.occasion || 'casual';
            document.getElementById('itemMaterial').value = item.material || '';
            document.getElementById('itemBoughtFrom').value = item.boughtFrom || '';
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemSize').value = item.size;
            document.getElementById('purchaseDate').value = item.date;
            document.getElementById('purchaseAmount').value = item.amount;
            document.getElementById('itemSex').value = item.sex;
            document.getElementById('stillOwned').value = item.stillOwned;

            // Load photo if exists
            const photoBlob = await closetDB.getPhotoBlob(id);
            if (photoBlob) {
                const imageUrl = URL.createObjectURL(photoBlob);
                previewImg.src = imageUrl;
                previewImg.style.display = 'block';
                previewText.style.display = 'none';
            } else {
                previewImg.style.display = 'none';
                previewText.style.display = 'block';
            }

            document.getElementById('modalTitle').innerText = 'Edit Item';
            itemModal.style.display = 'flex';
        } catch (error) {
            console.error('Error editing item:', error);
            showAlert('Error loading item for editing. Please try again.', 'error');
        }
    };

    window.viewItem = async (id) => {
        try {
            const item = await closetDB.getItem(id);
            if (!item) {
                showAlert('Item not found', 'error');
                return;
            }
            viewCurrentId = id;

            // Load photo for viewing
            let imageUrl = 'https://via.placeholder.com/300x400?text=No+Photo';
            const photoBlob = await closetDB.getPhotoBlob(id);
            if (photoBlob) {
                imageUrl = URL.createObjectURL(photoBlob);
            }

            document.getElementById('viewImage').src = imageUrl;
            document.getElementById('viewType').innerText = item.type;
            document.getElementById('viewTitle').innerText = item.name;
            document.getElementById('viewBrand').innerText = item.brand || 'No Brand';

            document.getElementById('vSize').innerText = item.size || 'N/A';
            document.getElementById('vColor').innerText = item.color || 'N/A';
            document.getElementById('vSeason').innerText = item.season || 'N/A';
            document.getElementById('vOccasion').innerText = item.occasion || 'N/A';
            document.getElementById('vMaterial').innerText = item.material || 'N/A';
            document.getElementById('vBought').innerText = item.boughtFrom || 'N/A';
            document.getElementById('vAmount').innerText = item.amount || '0';
            document.getElementById('vSex').innerText = item.sex;
            document.getElementById('vDate').innerText = item.date || 'N/A';
            document.getElementById('vStatus').innerText = item.stillOwned === 'y' ? 'In Closet' : 'Gone';
            document.getElementById('viewDesc').innerText = item.description || 'No additional notes.';

            viewModal.style.display = 'flex';

            // Clean up URL when modal is closed
            if (photoBlob) {
                const viewImage = document.getElementById('viewImage');
                viewImage.addEventListener('load', () => {
                    URL.revokeObjectURL(imageUrl);
                });
            }
        } catch (error) {
            console.error('Error viewing item:', error);
            showAlert('Error loading item details. Please try again.', 'error');
        }
    };

    // Initial Render
    async function initializeApp() {
        try {
            await closetDB.init();
            inventory = await closetDB.getAllItems();

            // Add demo items if database is empty
            if (inventory.length === 0) {
                const demoItems = [
                    {
                        id: 'demo1',
                        name: 'Designer Jeans',
                        type: 'pants',
                        brand: 'Calvin Klein',
                        color: 'Dark Blue',
                        material: 'Denim',
                        size: '32W x 32L',
                        date: '2024-01-15',
                        amount: '89.99',
                        sex: 'male',
                        stillOwned: 'y',
                        season: 'all',
                        occasion: 'casual'
                    },
                    {
                        id: 'demo2',
                        name: 'Silk Evening Blouse',
                        type: 'blouse',
                        brand: 'Zara',
                        color: 'Black',
                        material: 'Silk',
                        size: 'M',
                        date: '2023-11-20',
                        amount: '45.50',
                        sex: 'female',
                        stillOwned: 'y',
                        season: 'fall',
                        occasion: 'formal'
                    },
                    {
                        id: 'demo3',
                        name: 'Running Sneakers',
                        type: 'sneakers',
                        brand: 'Nike',
                        color: 'White/Red',
                        material: 'Mesh/Synthetic',
                        size: '10',
                        date: '2023-05-10',
                        amount: '120.00',
                        sex: 'unisex',
                        stillOwned: 'y',
                        season: 'all',
                        occasion: 'activewear'
                    }
                ];

                // Save demo items
                for (const item of demoItems) {
                    await closetDB.saveItem(item);
                }

                inventory = await closetDB.getAllItems();
            }

            updateFilterOptions();
            applyFilters();
        } catch (error) {
            console.error('Error initializing app:', error);
            showAlert('Error loading application. Please refresh the page.', 'error');
        }
    }

    // Start the application
    initializeApp();
});
