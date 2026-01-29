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
    let inventory = JSON.parse(localStorage.getItem('closet_inventory')) || [];
    let isEditing = false;
    let currentStream = null;

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

    // --- Core Functions ---

    function saveInventory() {
        localStorage.setItem('closet_inventory', JSON.stringify(inventory));
        updateFilterOptions();
        applyFilters();
    }

    function applyFilters() {
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

            // Log exclusions for debugging
            if (!matchesSearch || !matchesSex || !matchesType || !matchesSize) {
                // console.log('Filtered out:', item.name, { matchesSearch, matchesSex, matchesType }); 
            }

            return matchesSearch && matchesSex && matchesType && matchesSize &&
                matchesBrand && matchesColor && matchesSeason &&
                matchesOccasion && matchesMaterial && matchesOwned;
        });

        console.log(`Filtered down to ${filtered.length} items.`);
        renderInventory(filtered);
    }

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
                    <input type="checkbox" value="${val}" ${currentChecked.includes(val) ? 'checked' : ''}> ${val}
                </label>
            `).join('');
        };

        populateDynamicFilter(filterSize, 'size');
        populateDynamicFilter(filterBrand, 'brand');
        populateDynamicFilter(filterColor, 'color');
        populateDynamicFilter(filterMaterial, 'material');
    }

    function renderInventory(filteredData = null) {
        const dataToShow = filteredData || inventory;
        const countEl = document.getElementById('itemCount');
        if (countEl) countEl.innerText = `${dataToShow.length} Items Found`;

        if (dataToShow.length === 0) {
            inventoryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No items match your filters.</div>';
            return;
        }

        inventoryGrid.innerHTML = dataToShow.map(item => `
            <div class="item-card" data-id="${item.id}">
                <div class="item-owned ${item.stillOwned === 'y' ? 'yes' : 'no'}">
                    ${item.stillOwned === 'y' ? 'OWNED' : 'GONE'}
                </div>
                <img src="${item.image || 'https://via.placeholder.com/300x400?text=No+Photo'}" 
                     alt="${item.name}" 
                     class="item-image" 
                     onclick="viewItem('${item.id}')"
                     style="cursor: zoom-in">
                <div class="item-info">
                    <div class="item-type">${item.type}</div>
                    <div class="item-name" onclick="viewItem('${item.id}')" style="cursor: pointer">${item.name}</div>
                    <div class="item-tags">
                        ${item.brand ? `<span class="tag">B: ${item.brand}</span>` : ''}
                        ${item.size ? `<span class="tag">S: ${item.size}</span>` : ''}
                        ${item.color ? `<span class="tag">C: ${item.color}</span>` : ''}
                    </div>
                    <div class="item-actions">
                        <button onclick="editItem('${item.id}')" class="btn-icon" title="Edit">✎</button>
                        <button onclick="deleteItem('${item.id}')" class="btn-icon" title="Delete" style="color: #ff6b6b">🗑</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- Event Listeners ---

    // Modal Control
    // Exposed Global Actions
    window.handleOpenAddModal = function () {
        try {
            console.log('Open Add Modal Triggered');
            const itemModalEl = document.getElementById('itemModal'); // Get fresh reference
            if (!itemModalEl) {
                alert('Error: itemModal element not found!');
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
            if (pImg) pImg.style.display = 'none';

            const pTxt = document.getElementById('previewText');
            if (pTxt) pTxt.style.display = 'block';

            itemModalEl.style.display = 'flex';
            hideFab(); // Hide FAB when modal opens
        } catch (e) {
            alert('Error opening modal: ' + e.message);
            console.error(e);
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
    };

    // Search Functionality
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
        if (el) el.onchange = () => applyFilters();
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
    });

    // Form Submission
    itemForm.onsubmit = (e) => {
        e.preventDefault();

        const itemData = {
            id: document.getElementById('itemId').value || Date.now().toString(),
            name: document.getElementById('itemName').value,
            type: document.getElementById('itemType').value,
            brand: document.getElementById('itemBrand').value,
            color: document.getElementById('itemColor').value,
            season: document.getElementById('itemSeason').value,
            occasion: document.getElementById('itemOccasion').value,
            material: document.getElementById('itemMaterial').value,
            boughtFrom: document.getElementById('itemBoughtFrom').value,
            description: document.getElementById('itemDescription').value,
            size: document.getElementById('itemSize').value,
            date: document.getElementById('purchaseDate').value,
            amount: document.getElementById('purchaseAmount').value,
            sex: document.getElementById('itemSex').value,
            stillOwned: document.getElementById('stillOwned').value,
            image: previewImg.src !== window.location.href ? previewImg.src : null
        };

        if (isEditing) {
            const index = inventory.findIndex(i => i.id === itemData.id);
            inventory[index] = itemData;
        } else {
            inventory.push(itemData);
        }

        saveInventory();
        itemModal.style.display = 'none';
    };

    // Image Handling
    imagePreview.onclick = () => imageInput.click();

    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                previewImg.src = re.target.result;
                previewImg.style.display = 'block';
                previewText.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
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
            const useFilePicker = confirm(
                "Could not access camera: " + err.message + "\n\n" +
                "Would you like to select a photo from your gallery instead?"
            );
            if (useFilePicker) {
                imageInput.click();
            }
        }
    };

    snap.onclick = () => {
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
    window.deleteItem = (id) => {
        if (confirm('Verify: Permanently remove this item from your closet?')) {
            inventory = inventory.filter(i => i.id !== id);
            saveInventory();
        }
    };

    window.editItem = (id) => {
        const item = inventory.find(i => i.id === id);
        if (!item) return;

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

        if (item.image) {
            previewImg.src = item.image;
            previewImg.style.display = 'block';
            previewText.style.display = 'none';
        } else {
            previewImg.style.display = 'none';
            previewText.style.display = 'block';
        }

        document.getElementById('modalTitle').innerText = 'Edit Item';
        itemModal.style.display = 'flex';
    };

    window.viewItem = (id) => {
        const item = inventory.find(i => i.id === id);
        if (!item) return;
        viewCurrentId = id;

        document.getElementById('viewImage').src = item.image || 'https://via.placeholder.com/300x400?text=No+Photo';
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
    };

    // Initial Render
    if (inventory.length === 0) {
        inventory = [
            {
                id: 'demo1',
                name: 'Midnight Velvet Blazer',
                type: 'jacket',
                brand: 'Tom Ford',
                color: 'Midnight Blue',
                material: 'Velvet',
                size: '42R',
                date: '2024-01-15',
                amount: '450',
                sex: 'male',
                stillOwned: 'y',
                image: 'https://images.unsplash.com/photo-1594932224491-994b9247f4f2?auto=format&fit=crop&q=80&w=800'
            },
            {
                id: 'demo2',
                name: 'Silk Crepe Blouse',
                type: 'blouse',
                brand: 'Gucci',
                color: 'Emerald',
                material: 'Silk',
                size: 'S',
                date: '2023-11-20',
                amount: '180',
                sex: 'female',
                stillOwned: 'y',
                image: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&q=80&w=800'
            },
            {
                id: 'demo3',
                name: 'Classic Leather Loafers',
                type: 'shoes',
                brand: 'Church\'s',
                color: 'Oxblood',
                material: 'Leather',
                size: '10',
                date: '2023-05-10',
                amount: '220',
                sex: 'unisex',
                stillOwned: 'y',
                image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&q=80&w=800'
            }
        ];
        saveInventory();
        updateFilterOptions();
        applyFilters();
    } else {
        updateFilterOptions();
        applyFilters();
    }
});
