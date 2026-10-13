/* ============================================================
   Nepal Rent Hub - Cascading Province / District / Palika / Ward

   Dataset: rukh-debug/location-np, nepali.json (MIT).
   https://github.com/rukh-debug/location-np
   The dataset is loaded from a public CDN, not from Google Sheets.
   If it is unavailable, the form will not silently invent ward data.
   ============================================================ */
(function () {
    'use strict';

    const SOURCE = 'https://cdn.jsdelivr.net/gh/rukh-debug/location-np@main/nepali.json';
    const FALLBACK_SOURCE = 'https://cdn.jsdelivr.net/gh/rukh-debug/location-np@master/nepali.json';
    const CACHE_KEY = 'nrh_nepal_locations_v1';
    const provinceSelect = document.querySelector('[name="province"]');
    const districtSelect = document.getElementById('districtSelect');
    const municipalitySelect = document.getElementById('municipalitySelect');
    const wardSelect = document.getElementById('wardSelect');

    if (!provinceSelect || !districtSelect || !municipalitySelect || !wardSelect) {
        return;
    }

    let locationTree = null;
    let provinceKey = '';
    let districtKey = '';
    let municipalityKey = '';

    const provinceAliases = {
        'कोशी': ['कोशी', 'प्रदेश १', 'प्रदेश नं. १', 'प्रदेश नं १', 'प्रदेश १'],
        'मधेश': ['मधेश', 'प्रदेश २', 'प्रदेश नं. २', 'प्रदेश नं २'],
        'बागमती': ['बागमती', 'प्रदेश ३', 'प्रदेश नं. ३', 'प्रदेश नं ३'],
        'गण्डकी': ['गण्डकी', 'प्रदेश ४', 'प्रदेश नं. ४', 'प्रदेश नं ४'],
        'लुम्बिनी': ['लुम्बिनी', 'प्रदेश ५', 'प्रदेश नं. ५', 'प्रदेश नं ५'],
        'कर्णाली': ['कर्णाली', 'प्रदेश ६', 'प्रदेश नं. ६', 'प्रदेश नं ६'],
        'सुदूरपश्चिम': ['सुदूरपश्चिम', 'सुदूर पश्चिम', 'प्रदेश ७', 'प्रदेश नं. ७', 'प्रदेश नं ७']
    };

    function normalize(value) {
        return String(value || '')
            .replace(/[\s‌‍.\-–_]+/g, '')
            .replace(/प्रदेश|प्रान्त|नम्बर|नं/g, '')
            .trim();
    }

    function resolveKey(object, name, aliases) {
        if (!object || typeof object !== 'object') return '';
        const candidates = [name, ...(aliases || [])].map(normalize);
        return Object.keys(object).find(function (key) {
            const candidate = normalize(key);
            return candidates.includes(candidate) || candidates.some(function (item) {
                return item && (candidate.includes(item) || item.includes(candidate));
            });
        }) || '';
    }

    function setOptions(select, placeholder, options) {
        select.replaceChildren(new Option(placeholder, ''));
        options.forEach(function (item) {
            select.add(new Option(item.label, item.value));
        });
        select.disabled = options.length === 0;
    }

    function resetWards() {
        municipalityKey = '';
        setOptions(wardSelect, 'पहिले पालिका छान्नुहोस्', []);
    }

    function resetMunicipalities() {
        districtKey = '';
        setOptions(municipalitySelect, 'पहिले जिल्ला छान्नुहोस्', []);
        resetWards();
    }

    function resetDistricts() {
        provinceKey = '';
        setOptions(districtSelect, 'पहिले प्रदेश छान्नुहोस्', []);
        resetMunicipalities();
    }

    function updateProvince() {
        resetDistricts();
        if (!locationTree || !provinceSelect.value) return;
        provinceKey = resolveKey(
            locationTree,
            provinceSelect.value,
            provinceAliases[provinceSelect.value]
        );
        const districts = locationTree[provinceKey];
        if (!districts || typeof districts !== 'object') return;
        const names = Object.keys(districts).sort(function (a, b) {
            return a.localeCompare(b, 'ne');
        });
        setOptions(districtSelect, 'जिल्ला छान्नुहोस्', names.map(function (name) {
            return { label: name, value: name };
        }));
    }

    function updateDistrict() {
        resetMunicipalities();
        if (!locationTree || !provinceKey || !districtSelect.value) return;
        const districts = locationTree[provinceKey];
        districtKey = resolveKey(districts, districtSelect.value);
        const municipalities = districts[districtKey];
        if (!municipalities || typeof municipalities !== 'object') return;
        const names = Object.keys(municipalities).sort(function (a, b) {
            return a.localeCompare(b, 'ne');
        });
        setOptions(municipalitySelect, 'पालिका छान्नुहोस्', names.map(function (name) {
            return { label: name, value: name };
        }));
    }

    function updateMunicipality() {
        resetWards();
        if (!locationTree || !districtKey || !municipalitySelect.value) return;
        const municipalities = locationTree[provinceKey][districtKey];
        municipalityKey = resolveKey(municipalities, municipalitySelect.value);
        const wards = municipalities[municipalityKey];
        if (!Array.isArray(wards)) return;
        const valid = wards.map(function (ward) {
            return String(ward).replace(/[^0-9०-९]/g, '');
        }).filter(Boolean);
        const unique = [...new Set(valid)];
        setOptions(wardSelect, 'वडा छान्नुहोस्', unique.map(function (number) {
            return { label: 'वडा नं. ' + number, value: number };
        }));
    }

    function isValid() {
        return Boolean(
            locationTree && provinceKey && districtKey && municipalityKey &&
            wardSelect.value && !wardSelect.disabled &&
            Array.from(wardSelect.options).some(function (option) {
                return option.value === wardSelect.value;
            })
        );
    }

    function showError() {
        let status = document.getElementById('locationDataStatus');
        if (!status) {
            status = document.createElement('p');
            status.id = 'locationDataStatus';
            status.className = 'notice error small';
            provinceSelect.closest('.field').before(status);
        }
        status.textContent = 'स्थान विवरण लोड हुन सकेन । इन्टरनेट जाँच गरी पेज Reload गर्नुहोस् ।';
    }

    async function fetchDataset(url) {
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Invalid location dataset');
        }
        return data;
    }

    async function loadLocations() {
        try {
            let cached = null;
            try { cached = sessionStorage.getItem(CACHE_KEY); } catch (error) { /* optional cache */ }
            if (cached) {
                locationTree = JSON.parse(cached);
            } else {
                try {
                    locationTree = await fetchDataset(SOURCE);
                } catch (firstError) {
                    locationTree = await fetchDataset(FALLBACK_SOURCE);
                }
                try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(locationTree)); } catch (error) { /* optional cache */ }
            }
            updateProvince();
        } catch (error) {
            console.error('Nepal location data failed:', error);
            showError();
        }
    }

    provinceSelect.addEventListener('change', updateProvince);
    districtSelect.addEventListener('change', updateDistrict);
    municipalitySelect.addEventListener('change', updateMunicipality);
    window.validateNepalLocation = isValid;
    window.resetNepalLocation = resetDistricts;
    resetDistricts();
    loadLocations();
}());
