document.addEventListener('DOMContentLoaded', function() {
    console.log("Energy tracker initializing...");

    if (!window.DevicesData) {
        console.error("No device data found!");
        window.DevicesData = [];
    }

    console.log("Loaded", window.DevicesData.length, "devices");

    let currentSection = null;
    let addedDevices = [];
    let usageHistory = loadUsageHistory();

    const sectionContainer = document.getElementById('section-container');
    const deviceContainer = document.getElementById('device-container');
    const addedDevicesContainer = document.getElementById('added-devices-container');
    const searchInput = document.getElementById('search-input');
    const currentSectionText = document.getElementById('current-section');
    const backButton = document.getElementById('back-button');

    const energyChartCanvas = document.getElementById('energy-chart');
    let energyChart = null;

    if (energyChartCanvas) {

        energyChart = new Chart(energyChartCanvas, {
            type: 'line',
            data: {
                labels: getLastNDays(7),
                datasets: [{
                    label: 'Daily Energy Usage (kWh)',
                    data: getDailyUsageData(7),
                    borderColor: 'rgb(64, 150, 246)',
                    backgroundColor: 'rgba(64, 150, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Energy Used (kWh)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Energy: ${context.parsed.y.toFixed(2)} kWh`;
                            }
                        }
                    }
                }
            }
        });
    }

    showSections();
    updateAddedDevicesView();
    updateEnergyStats();

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        if (searchTerm.length > 1) {
            searchDevices(searchTerm);
        } else if (currentSection) {
            showDevicesInSection(currentSection);
        } else {
            showSections();
        }
    });

    backButton.addEventListener('click', function() {
        showSections();
        currentSection = null;
        updateCurrentSectionView();
    });

    const trackUsageBtn = document.getElementById('track-usage-btn');
    if (trackUsageBtn) {
        trackUsageBtn.addEventListener('click', function() {
            trackDailyUsage();
        });
    }

    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', function() {
            const days = parseInt(this.dataset.days);
            updateChartTimeframe(days);

            document.querySelectorAll('.timeframe-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    function showSections() {
        sectionContainer.style.display = 'grid';
        deviceContainer.style.display = 'none';
        backButton.style.display = 'none';

        sectionContainer.innerHTML = '';

        const sections = [...new Set(getAllDevices().map(device => device.section))];
        sections.forEach(section => {
            const sectionEl = createSectionElement(section);
            sectionContainer.appendChild(sectionEl);
        });

        const customSection = createSectionElement('Add Your Own');
        customSection.querySelector('.section-icon').textContent = 'add_circle';
        sectionContainer.appendChild(customSection);

        updateCurrentSectionView();
    }

    function showDevicesInSection(sectionName) {
        currentSection = sectionName;
        sectionContainer.style.display = 'none';
        deviceContainer.style.display = 'grid';
        backButton.style.display = 'flex';

        deviceContainer.innerHTML = '';

        const devices = getAllDevices().filter(device => device.section === sectionName);
        devices.forEach(device => {
            const deviceEl = createDeviceElement(device);
            deviceContainer.appendChild(deviceEl);
        });

        updateCurrentSectionView();
    }

    function searchDevices(searchTerm) {
        sectionContainer.style.display = 'none';
        deviceContainer.style.display = 'grid';
        backButton.style.display = 'flex';

        deviceContainer.innerHTML = '';

        const matchingDevices = getAllDevices().filter(device => 
            device.name.toLowerCase().includes(searchTerm)
        );

        if (matchingDevices.length > 0) {
            matchingDevices.forEach(device => {
                const deviceEl = createDeviceElement(device);
                deviceContainer.appendChild(deviceEl);
            });
        } else {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = `
                <p>No devices found for "${searchTerm}"</p>
                <button id="add-custom-device" class="add-custom-btn">
                    <span class="material-symbols-outlined">add_circle</span>
                    Add Custom Device
                </button>
            `;
            deviceContainer.appendChild(noResults);

            document.getElementById('add-custom-device').addEventListener('click', function() {
                showAddCustomDeviceForm(searchTerm);
            });
        }

        updateCurrentSectionView(searchTerm);
    }

    function showAddCustomDeviceForm(initialName = '') {
        const modal = document.createElement('div');
        modal.className = 'custom-device-modal';
        modal.innerHTML = `
            <div class="custom-device-form">
                <h3>Add Custom Device</h3>
                <div class="form-group">
                    <label for="custom-device-name">Device Name:</label>
                    <input type="text" id="custom-device-name" value="${initialName}">
                </div>
                <div class="form-group">
                    <label for="custom-device-section">Category:</label>
                    <select id="custom-device-section">
                        <option value="Kitchen Appliances">Kitchen Appliances</option>
                        <option value="Bedroom Devices">Bedroom Devices</option>
                        <option value="Laundry & Cleaning">Laundry & Cleaning</option>
                        <option value="Bathroom Utilities">Bathroom Utilities</option>
                        <option value="Smart Home">Smart Home</option>
                        <option value="Outdoor & Garden">Outdoor & Garden</option>
                        <option value="General Electronics">General Electronics</option>
                        <option value="Custom">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="custom-device-icon">Icon:</label>
                    <select id="custom-device-icon">
                        <option value="laptop">Laptop</option>
                        <option value="tv">TV</option>
                        <option value="lightbulb">Light</option>
                        <option value="kitchen">Kitchen</option>
                        <option value="electrical_services">Electrical</option>
                        <option value="device_unknown">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="custom-device-wattage">Average Wattage (W):</label>
                    <input type="number" id="custom-device-wattage" placeholder="e.g. 100" min="1">
                </div>
                <div class="form-actions">
                    <button id="cancel-custom-device" class="cancel-btn">Cancel</button>
                    <button id="save-custom-device" class="save-btn">Save Device</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const similarDevices = findSimilarDevices(initialName);
        if (similarDevices.length > 0) {
            const similarDevicesEl = document.createElement('div');
            similarDevicesEl.className = 'similar-devices';
            similarDevicesEl.innerHTML = `
                <p>Were you looking for one of these?</p>
                <div class="similar-devices-list"></div>
            `;

            const listEl = similarDevicesEl.querySelector('.similar-devices-list');
            similarDevices.forEach(device => {
                const deviceBtn = document.createElement('button');
                deviceBtn.className = 'similar-device-btn';
                deviceBtn.innerHTML = `
                    <span class="material-symbols-outlined">${getIconForDevice(device)}</span>
                    ${device.name}
                `;
                deviceBtn.addEventListener('click', function() {
                    addDevice(device);
                    modal.remove();
                });
                listEl.appendChild(deviceBtn);
            });

            modal.querySelector('.custom-device-form').appendChild(similarDevicesEl);
        }

        document.getElementById('cancel-custom-device').addEventListener('click', function() {
            modal.remove();
        });

        document.getElementById('save-custom-device').addEventListener('click', function() {
            const name = document.getElementById('custom-device-name').value;
            const section = document.getElementById('custom-device-section').value;
            const icon = document.getElementById('custom-device-icon').value;
            const wattage = parseInt(document.getElementById('custom-device-wattage').value) || 100;

            if (name.trim()) {
                const newDevice = {
                    name: name.trim(),
                    section: section,
                    icon: icon,
                    wattage: wattage,
                    custom: true
                };

                addDevice(newDevice);
                modal.remove();
            }
        });
    }

    function findSimilarDevices(searchTerm) {
        if (!searchTerm) return [];

        searchTerm = searchTerm.toLowerCase();
        return getAllDevices().filter(device => {
            const deviceName = device.name.toLowerCase();
            return deviceName.includes(searchTerm) || 
                   searchTerm.includes(deviceName) ||
                   levenshteinDistance(deviceName, searchTerm) <= 3;
        }).slice(0, 3); 
    }

    function levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i-1) === a.charAt(j-1)) {
                    matrix[i][j] = matrix[i-1][j-1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i-1][j-1] + 1,
                        matrix[i][j-1] + 1,
                        matrix[i-1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    function createSectionElement(sectionName) {
        const sectionEl = document.createElement('div');
        sectionEl.className = 'section-item';
        sectionEl.innerHTML = `
            <span class="material-symbols-outlined section-icon">${getIconForSection(sectionName)}</span>
            <span class="section-name">${sectionName}</span>
        `;

        sectionEl.addEventListener('click', function() {
            if (sectionName === 'Add Your Own') {
                showAddCustomDeviceForm();
            } else {
                showDevicesInSection(sectionName);
            }
        });

        return sectionEl;
    }

    function createDeviceElement(device) {
        const deviceEl = document.createElement('div');
        deviceEl.className = 'device-item';
        deviceEl.dataset.name = device.name;
        deviceEl.innerHTML = `
            <span class="material-symbols-outlined device-icon">${getIconForDevice(device)}</span>
            <span class="device-name">${device.name}</span>
        `;

        deviceEl.addEventListener('click', function() {
            addDevice(device);
        });

        return deviceEl;
    }

    function addDevice(device) {
        const existingDeviceIndex = addedDevices.findIndex(d => 
            d.name === device.name && d.section === device.section
        );

        if (existingDeviceIndex >= 0) {
            addedDevices[existingDeviceIndex].quantity += 1;
        } else {

            const wattage = device.wattage || getDefaultWattage(device.name);

            addedDevices.push({
                ...device,
                wattage: wattage,
                quantity: 1,
                usageHoursPerDay: 2  
            });
        }

        saveAddedDevices();
        updateAddedDevicesView();
        updateEnergyStats();
    }

    function getDefaultWattage(deviceName) {
        const name = deviceName.toLowerCase();
        if (name.includes('fridge')) return 200;
        if (name.includes('tv')) return 100;
        if (name.includes('lamp') || name.includes('light')) return 60;
        if (name.includes('computer') || name.includes('pc')) return 300;
        if (name.includes('laptop')) return 60;
        if (name.includes('microwave')) return 1000;
        if (name.includes('dishwasher')) return 1500;
        if (name.includes('washing')) return 500;
        if (name.includes('dryer')) return 3000;
        if (name.includes('oven')) return 2000;
        if (name.includes('coffee')) return 1000;
        if (name.includes('air condition')) return 1500;
        if (name.includes('vacuum')) return 1200;
        if (name.includes('game') || name.includes('console')) return 150;
        if (name.includes('charger')) return 10;

        return 100;
    }

    function removeDevice(index) {
        addedDevices.splice(index, 1);
        saveAddedDevices();
        updateAddedDevicesView();
        updateEnergyStats();
    }

    function updateDeviceQuantity(index, newQuantity) {
        if (newQuantity <= 0) {
            removeDevice(index);
        } else {
            addedDevices[index].quantity = newQuantity;
            saveAddedDevices();
            updateAddedDevicesView();
            updateEnergyStats();
        }
    }

    function updateDeviceUsageHours(index, hours) {
        if (hours > 0 && hours <= 24) {
            addedDevices[index].usageHoursPerDay = hours;
            saveAddedDevices();
            updateEnergyStats();
        }
    }

    function updateCurrentSectionView(searchQuery) {
        if (searchQuery) {
            currentSectionText.textContent = `Search results for: ${searchQuery}`;
        } else if (currentSection) {
            currentSectionText.textContent = `Current Section: ${currentSection}`;
        } else {
            currentSectionText.textContent = 'All Sections';
        }
    }

    function updateAddedDevicesView() {
        addedDevicesContainer.innerHTML = '';

        if (addedDevices.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <p>No devices added yet</p>
                <p class="hint">Click on devices to add them to your tracker</p>
            `;
            addedDevicesContainer.appendChild(emptyState);
            return;
        }

        addedDevices.forEach((device, index) => {
            const deviceEl = document.createElement('div');
            deviceEl.className = 'added-device-item';
            deviceEl.innerHTML = `
                <div class="added-device-info">
                    <span class="material-symbols-outlined">${getIconForDevice(device)}</span>
                    <span class="added-device-name">${device.name}</span>
                    <span class="added-device-section">${device.section}</span>
                </div>
                <div class="added-device-details">
                    <div class="device-wattage">${device.wattage}W</div>
                    <div class="device-hours">
                        <label>Hours/day: </label>
                        <input type="number" min="0.1" max="24" step="0.1" value="${device.usageHoursPerDay}" class="hours-input">
                    </div>
                </div>
                <div class="added-device-controls">
                    <button class="quantity-btn decrease">-</button>
                    <span class="quantity">${device.quantity}</span>
                    <button class="quantity-btn increase">+</button>
                    <button class="remove-btn">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;

            deviceEl.querySelector('.decrease').addEventListener('click', function() {
                updateDeviceQuantity(index, device.quantity - 1);
            });

            deviceEl.querySelector('.increase').addEventListener('click', function() {
                updateDeviceQuantity(index, device.quantity + 1);
            });

            deviceEl.querySelector('.hours-input').addEventListener('change', function() {
                updateDeviceUsageHours(index, parseFloat(this.value));
            });

            deviceEl.querySelector('.remove-btn').addEventListener('click', function() {
                removeDevice(index);
            });

            addedDevicesContainer.appendChild(deviceEl);
        });
    }

    function calculateTotalEnergyUsage() {
        return addedDevices.reduce((total, device) => {

            const deviceDailyUsage = (device.wattage * device.usageHoursPerDay * device.quantity) / 1000;
            return total + deviceDailyUsage;
        }, 0);
    }

    function calculateTotalCost(kWh, rate = 0.34) {  
        return kWh * rate;
    }

    function updateEnergyStats() {
        const dailyUsage = calculateTotalEnergyUsage();
        const weeklyCost = calculateTotalCost(dailyUsage * 7);
        const monthlyCost = calculateTotalCost(dailyUsage * 30);
        const yearlyCost = calculateTotalCost(dailyUsage * 365);

        const statsContainer = document.getElementById('energy-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <div class="stat-label">Daily Usage</div>
                    <div class="stat-value">${dailyUsage.toFixed(2)} kWh</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Weekly Cost</div>
                    <div class="stat-value">$${weeklyCost.toFixed(2)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Monthly Cost</div>
                    <div class="stat-value">$${monthlyCost.toFixed(2)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Yearly Cost</div>
                    <div class="stat-value">$${yearlyCost.toFixed(2)}</div>
                </div>
            `;
        }
    }

    function trackDailyUsage() {
        const today = new Date().toISOString().split('T')[0];
        const dailyUsage = calculateTotalEnergyUsage();

        if (!usageHistory[today]) {
            usageHistory[today] = dailyUsage;
        } else {

            usageHistory[today] = dailyUsage;
        }

        saveUsageHistory();
        updateChartTimeframe(7); 

        const trackingMsg = document.getElementById('tracking-message');
        if (trackingMsg) {
            trackingMsg.textContent = `Usage tracked for today: ${dailyUsage.toFixed(2)} kWh`;
            trackingMsg.style.display = 'block';

            setTimeout(() => {
                trackingMsg.style.display = 'none';
            }, 3000);
        }
    }

    function updateChartTimeframe(days) {
        if (!energyChart) return;

        const labels = getLastNDays(days);
        const data = getDailyUsageData(days);

        energyChart.data.labels = labels;
        energyChart.data.datasets[0].data = data;
        energyChart.update();
    }

    function getLastNDays(n) {
        const result = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            result.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        return result;
    }

    function getDailyUsageData(days) {
        const result = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            result.push(usageHistory[dateStr] || 0);
        }

        return result;
    }

    function saveAddedDevices() {
        localStorage.setItem('energyTrackerDevices', JSON.stringify(addedDevices));
    }

    function loadAddedDevices() {
        const saved = localStorage.getItem('energyTrackerDevices');
        return saved ? JSON.parse(saved) : [];
    }

    function saveUsageHistory() {
        localStorage.setItem('energyUsageHistory', JSON.stringify(usageHistory));
    }

    function loadUsageHistory() {
        const saved = localStorage.getItem('energyUsageHistory');
        return saved ? JSON.parse(saved) : {};
    }

    function getIconForSection(sectionName) {
        const iconMap = {
            'Kitchen Appliances': 'kitchen',
            'Bedroom Devices': 'bedroom',
            'Laundry & Cleaning': 'local_laundry_service',
            'Bathroom Utilities': 'shower',
            'Smart Home': 'smart_display',
            'Outdoor & Garden': 'outdoor_garden',
            'General Electronics': 'electrical_services',
            'Add Your Own': 'add_circle'
        };

        return iconMap[sectionName] || 'device_unknown';
    }

    function getIconForDevice(device) {
        if (device.icon && device.icon !== 'material-symbols-outlined') {
            return device.icon;
        }

        const nameLower = device.name.toLowerCase();
        if (nameLower.includes('fridge')) return 'kitchen';
        if (nameLower.includes('microwave')) return 'microwave';
        if (nameLower.includes('dishwasher')) return 'dishwasher';
        if (nameLower.includes('oven')) return 'oven';
        if (nameLower.includes('coffee')) return 'coffee';
        if (nameLower.includes('tv')) return 'tv';
        if (nameLower.includes('lamp') || nameLower.includes('light')) return 'lightbulb';
        if (nameLower.includes('washer') || nameLower.includes('washing')) return 'local_laundry_service';
        if (nameLower.includes('dryer')) return 'dry_cleaning';
        if (nameLower.includes('vacuum')) return 'vacuum';
        if (nameLower.includes('computer') || nameLower.includes('pc')) return 'computer';
        if (nameLower.includes('laptop')) return 'laptop';
        if (nameLower.includes('game') || nameLower.includes('console')) return 'sports_esports';
        if (nameLower.includes('charger')) return 'charger';

        return 'electrical_services';
    }

    function getAllDevices() {
        if (!window.DevicesData || !Array.isArray(window.DevicesData)) {
            console.warn("Device data is not available or not an array");
            return [];
        }
        return window.DevicesData;
    }

    addedDevices = loadAddedDevices();
});