/* Nepal Rent Hub — Owner Portal (readable, no external frameworks). */
(function () {
  'use strict';

  let ownerToken = sessionStorage.getItem('nrh_owner_token') || '';
  let units = [];
  let selectedUnit = null;
  let ownerAuthMode = 'login';

  function show(id, visible) {
    $(id).classList.toggle('owner-hidden', !visible);
  }

  function notice(id, text, error) {
    $(id).textContent = text;
    $(id).style.color = error ? '#a22121' : '#176044';
  }

  function busy(button, callback) {
    button.disabled = true;
    return Promise.resolve().then(callback).finally(function () {
      button.disabled = false;
    });
  }

  function ownerPost(payload) {
    return post(Object.assign({ownerToken: ownerToken}, payload));
  }

  async function loadOwner() {
    const profile = await ownerPost({action: 'ownerProfile'});
    show('ownerLogin', false);
    show('ownerDashboard', true);
    units = await ownerPost({action: 'ownerListings'});
    const available = units.filter(function (u) { return u.availability === 'AVAILABLE'; }).length;
    const rented = units.filter(function (u) { return u.availability === 'RENTED'; }).length;
    const vacated = units.filter(function (u) { return u.availability === 'VACATED'; }).length;
    $('ownerStats').innerHTML = [
      ['सम्पत्ति / Unit', units.length],
      ['Available', available],
      ['Rented', rented],
      ['Vacated', vacated]
    ].map(function (s) {
      return '<div class="owner-stat"><strong>' + s[1] + '</strong>' + esc(s[0]) + '</div>';
    }).join('');
    $('ownerUnits').innerHTML = units.map(function (u) {
      return '<article class="owner-unit"><div class="owner-status">' + esc(u.availability) +
        ' · ' + esc(u.listingStatus) + '</div><h3>' + esc(u.title || u.label) +
        '</h3><p>' + esc(u.label) + ' · ' + esc(u.district) + '</p><p>' +
        money(u.rent) + ' / महिना</p><p class="muted">Rent cycles: ' + u.cycles +
        '</p><p class="small muted">Unit: ' + esc(u.unitId) +
        '</p><div class="owner-actions"><button type="button" data-unit="' + esc(u.unitId) +
        '">व्यवस्थापन / History →</button></div></article>';
    }).join('') || '<p class="notice">अहिलेसम्म कुनै Unit छैन । नयाँ सम्पत्ति थप्नुहोस् ।</p>';
    $('ownerUnits').querySelectorAll('[data-unit]').forEach(function (button) {
      button.addEventListener('click', function () { openUnit(button.dataset.unit); });
    });
    notice('ownerMsg', 'स्वागत छ, ' + profile.name + ' ।');
  }

  function selectOwnerAuthMode(mode) {
    ownerAuthMode = ['login', 'register', 'reset'].includes(mode) ? mode : 'login';
    const registering = ownerAuthMode === 'register';
    const resetting = ownerAuthMode === 'reset';
    show('ownerNameField', registering);
    show('ownerPhoneField', registering);
    show('ownerRegisterPrompt', !registering);
    show('ownerForgotPrompt', !registering && !resetting);
    show('ownerConfirmPasswordField', registering || resetting);
    $('ownerName').required = registering;
    $('ownerPhone').required = registering;
    $('ownerConfirmPassword').required = registering || resetting;
    $('ownerPassword').required = true;
    $('ownerPassword').setAttribute('autocomplete', registering || resetting ? 'new-password' : 'current-password');
    $('ownerDetailsTitle').textContent = registering ? '① नयाँ Account बनाउनुहोस्' : resetting ? '① Password Reset गर्नुहोस्' : '① आफ्नो Account मा Login गर्नुहोस्';
    $('ownerModeHelp').textContent = registering
      ? 'नाम, मोबाइल, Email र नयाँ Password राख्नुहोस् । OTP Verify भएपछि Account बन्नेछ ।'
      : resetting ? 'दर्ता भएको Email र नयाँ Password राख्नुहोस् । OTP Verify भएपछि Password परिवर्तन हुनेछ ।'
      : 'दर्ता भएको Email र Password राखेर My Properties खोल्नुहोस् ।';
    $('ownerModeRegister').classList.toggle('is-selected', registering);
    $('ownerModeLogin').classList.toggle('is-selected', !registering);
    $('ownerModeRegister').setAttribute('aria-pressed', String(registering));
    $('ownerModeLogin').setAttribute('aria-pressed', String(!registering));
    $('otpSend').textContent = registering ? '➤ Register गर्न OTP पठाउनुहोस्' : resetting ? '➤ Reset OTP पठाउनुहोस्' : '➤ Login गर्नुहोस्';
    $('otpVerify').textContent = registering ? 'Verify & Register →' : 'Verify & Reset Password →';
    $('ownerOtp').value = '';
    ownerAuthStep(1);
    notice('authMsg', '');
  }

  $('ownerModeRegister').addEventListener('click', function () { selectOwnerAuthMode('register'); });
  $('ownerModeLogin').addEventListener('click', function () { selectOwnerAuthMode('login'); });
  $('ownerRegisterLink').addEventListener('click', function () { selectOwnerAuthMode('register'); });
  $('ownerForgotLink').addEventListener('click', function () { selectOwnerAuthMode('reset'); });

  function ownerAuthStep(step) {
    const verification = step === 2;
    show('ownerDetailsStep', !verification);
    show('ownerVerificationStep', verification);
    $('ownerStepOneLabel').classList.toggle('is-current', !verification);
    $('ownerStepTwoLabel').classList.toggle('is-current', verification);
    if (verification) {
      $('ownerOtpEmail').textContent = $('ownerEmail').value.trim();
      $('ownerOtp').focus();
    }
  }

  function ownerPasswordValid() {
    const password = $('ownerPassword').value;
    if (password.length < 12 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      notice('authMsg', 'Password १२–१२८ अक्षरको र कम्तीमा एउटा अक्षर तथा एउटा अंक भएको हुनुपर्छ ।', true);
      return false;
    }
    if (password !== $('ownerConfirmPassword').value) {
      notice('authMsg', 'Password र Confirm Password मिलेन ।', true);
      return false;
    }
    return true;
  }

  async function sendOwnerOtp() {
    const email = $('ownerEmail').value.trim();
    const phone = ownerAuthMode === 'register' ? $('ownerPhone').value.trim() : '';
    if (ownerAuthMode === 'register' && !$('ownerName').value.trim()) {
      notice('authMsg', 'पूरा नाम भर्नुहोस् ।', true);
      return;
    }
    if (phone && !/^(?:97|98)\d{8}$/.test(phone)) {
      notice('authMsg', 'सही १० अङ्कको मोबाइल नम्बर राख्नुहोस् ।', true);
      return;
    }
    if (!ownerPasswordValid()) return;
    const button = $('otpSend');
    await busy(button, async function () {
      try {
        notice('authMsg', 'Email मा OTP पठाइँदैछ...', false);
        const result = await post({action: 'ownerOtp', email: email, mode: ownerAuthMode, phone: phone});
        ownerAuthStep(2);
        notice('authMsg', result.message || 'OTP पठाइएको छ ।');
      } catch (error) {
        notice('authMsg', error.message, true);
      }
    });
  }

  $('ownerDetailsForm').addEventListener('submit', function (event) {
    event.preventDefault();
    if (ownerAuthMode === 'login') {
      busy($('otpSend'), async function () {
        try {
          notice('authMsg', 'Login जाँच हुँदैछ...', false);
          const result = await post({action: 'ownerPasswordLogin', email: $('ownerEmail').value.trim(), password: $('ownerPassword').value});
          ownerToken = result.token;
          sessionStorage.setItem('nrh_owner_token', ownerToken);
          await loadOwner();
        } catch (error) { notice('authMsg', error.message, true); }
      });
    } else sendOwnerOtp();
  });

  $('ownerOtpForm').addEventListener('submit', function (event) {
    event.preventDefault();
    busy($('otpVerify'), async function () {
      try {
        const result = await post({
          action: 'ownerVerify',
          email: $('ownerEmail').value.trim(),
          otp: $('ownerOtp').value.trim(),
          mode: ownerAuthMode,
          name: ownerAuthMode === 'register' ? $('ownerName').value.trim() : '',
          phone: ownerAuthMode === 'register' ? $('ownerPhone').value.trim() : '',
          password: $('ownerPassword').value
        });
        $('ownerPassword').value = '';
        $('ownerConfirmPassword').value = '';
        ownerToken = result.token;
        sessionStorage.setItem('nrh_owner_token', ownerToken);
        await loadOwner();
      } catch (error) { notice('authMsg', error.message, true); }
    });
  });

  $('ownerBackToDetails').addEventListener('click', function () {
    ownerAuthStep(1);
    notice('authMsg', '');
  });

  $('ownerResendOtp').addEventListener('click', async function () {
    const button = this;
    await busy(button, async function () {
      try {
        notice('authMsg', 'नयाँ OTP पठाइँदैछ...', false);
        const result = await post({action: 'ownerOtp', email: $('ownerEmail').value.trim(), mode: ownerAuthMode, phone: ownerAuthMode === 'register' ? $('ownerPhone').value.trim() : ''});
        notice('authMsg', result.message || 'नयाँ OTP पठाइएको छ ।');
      } catch (error) { notice('authMsg', error.message, true); }
    });
  });

  $('ownerLogout').addEventListener('click', function () {
    ownerToken = '';
    sessionStorage.removeItem('nrh_owner_token');
    $('ownerPassword').value = '';
    show('ownerLogin', true);
    show('ownerDashboard', false);
    selectOwnerAuthMode('login');
  });

  $('refreshOwner').addEventListener('click', async function () {
    try { await loadOwner(); } catch (error) { notice('ownerMsg', error.message, true); }
  });

  $('newProperty').addEventListener('click', function () {
    show('unitPanel', false);
    show('ownerPostPanel', true);
    $('ownerPostPanel').scrollIntoView({behavior: 'smooth'});
  });
  $('cancelOwnerPost').addEventListener('click', function () { show('ownerPostPanel', false); });

  async function bankInfo() {
    try {
      const response = await jsonp('config');
      if (!response.ok) throw Error('Settings not available');
      const config = response.data;
      $('ownerBankInfo').innerHTML = '<strong>विज्ञापन शुल्क: ' + money(config.basicPrice) +
        '</strong><p>' + esc(config.bankName) + ' ' + esc(config.bankAccount) +
        '</p>' + (safeImage(config.bankQrUrl) ? '<img width="170" alt="Bank QR" src="' +
        esc(safeImage(config.bankQrUrl)) + '">' : '');
    } catch (error) { $('ownerBankInfo').textContent = 'Bank Settings लोड भएन ।'; }
  }

  // Keep payload within Apps Script form transport limits: images become JPEG <= 390 KB.
  async function ownerPhotoData(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw Error('JPG, PNG वा WEBP फोटो मात्र Upload गर्नुहोस् ।');
    }
    if (file.size > 8 * 1024 * 1024) throw Error('फोटो ८ MB भन्दा ठूलो हुनु हुँदैन ।');
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.78, 0.62, 0.46, 0.32]) {
        const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        if (base64.length <= 520000) return {mimeType: 'image/jpeg', base64: base64};
      }
      throw Error('फोटो धेरै ठूलो छ । अर्को फोटो छान्नुहोस् ।');
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  async function ownerVoucherData(file) {
    if (!file) throw Error('Bank Voucher Upload गर्नुहोस् ।');
    if (file.type === 'application/pdf') {
      if (file.size > 950000) throw Error('PDF Voucher ९५० KB भन्दा सानो हुनुपर्छ ।');
      return {mimeType: 'application/pdf', base64: await ownerReadBase64(file)};
    }
    const photo = await ownerPhotoData(file);
    if (photo.base64.length > 1260000) throw Error('Voucher धेरै ठूलो छ ।');
    return photo;
  }

  function ownerReadBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = function () { reject(Error('File पढ्न सकिएन ।')); };
      reader.readAsDataURL(file);
    });
  }

  const ownerPreviewIds = {
    ownerPhotoExterior: 'ownerPreviewExterior',
    ownerPhotoInterior: 'ownerPreviewInterior',
    ownerPhotoOther: 'ownerPreviewOther'
  };
  Object.keys(ownerPreviewIds).forEach(function (id) {
    $(id).addEventListener('change', function () {
      const img = $(ownerPreviewIds[id]);
      if (img.dataset.previewUrl) URL.revokeObjectURL(img.dataset.previewUrl);
      img.removeAttribute('src');
      img.classList.add('owner-hidden');
      if (this.files[0]) {
        img.dataset.previewUrl = URL.createObjectURL(this.files[0]);
        img.src = img.dataset.previewUrl;
        img.classList.remove('owner-hidden');
      }
    });
  });
  document.querySelectorAll('.owner-upload-remove').forEach(function (button) {
    button.addEventListener('click', function () {
      const input = $(button.dataset.clear);
      input.value = '';
      input.dispatchEvent(new Event('change'));
    });
  });
  $('ownerPaymentVoucher').addEventListener('change', function () {
    const box = $('ownerVoucherPreview');
    const file = this.files[0];
    box.textContent = file ? 'छानिएको Voucher: ' + file.name : '';
    box.classList.toggle('owner-hidden', !file);
  });
  $('ownerVoucherRemove').addEventListener('click', function () {
    $('ownerPaymentVoucher').value = '';
    $('ownerPaymentVoucher').dispatchEvent(new Event('change'));
  });

  $('propertyForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const form = this;
    busy($('ownerSubmit'), async function () {
      try {
        if (window.validateNepalLocation && !window.validateNepalLocation()) {
          throw Error('सही प्रदेश, जिल्ला, पालिका र वडा छान्नुहोस् ।');
        }
        const payload = Object.fromEntries(new FormData(form).entries());
        payload.detailsJson = JSON.stringify({
          floor: $('detailFloor').value, area: $('detailArea').value,
          bathroom: $('detailBath').value, kitchen: $('detailKitchen').value,
          parking: $('detailParking').value
        });
        const progress = $('ownerUploadProgress');
        const exterior = $('ownerPhotoExterior').files[0];
        const interior = $('ownerPhotoInterior').files[0];
        const other = $('ownerPhotoOther').files[0];
        if (!exterior || !interior) throw Error('घरको बाहिरी र कोठाको भित्री फोटो अनिवार्य छन् ।');
        progress.textContent = 'सम्पत्तिका फोटो तयार गरिँदैछन्...';
        payload.photoUploads = [];
        for (const file of [exterior, interior, other].filter(Boolean)) {
          payload.photoUploads.push(await ownerPhotoData(file));
        }
        progress.textContent = 'Bank Voucher तयार गरिँदैछ...';
        payload.paymentVoucherUpload = await ownerVoucherData($('ownerPaymentVoucher').files[0]);
        delete payload.photoUrls;
        delete payload.paymentProofUrl;
        progress.textContent = 'फोटो र Voucher सहित Admin Review मा पठाइँदैछ...';
        const result = await ownerPost(Object.assign({action: 'ownerCreate'}, payload));
        notice('postMsg', 'विज्ञापन प्राप्त भयो । Unit ID: ' + result.unitId + ' — ' + result.status);
        form.reset();
        Object.keys(ownerPreviewIds).forEach(function (id) { $(id).dispatchEvent(new Event('change')); });
        $('ownerPaymentVoucher').dispatchEvent(new Event('change'));
        $('ownerUploadProgress').textContent = '';
        if (window.resetNepalLocation) window.resetNepalLocation();
        await loadOwner();
        show('ownerPostPanel', false);
      } catch (error) { notice('postMsg', error.message, true); }
    });
  });

  function currentUnit() {
    return units.find(function (u) { return u.unitId === selectedUnit; });
  }

  function unitOperationHtml(u) {
    if (u.availability === 'AVAILABLE' && u.listingStatus === 'PUBLISHED') {
      return '<form id="rentForm"><h3>🔑 भाडामा गयो</h3><div class="two">' +
        '<div class="field"><label>भाडा सुरु मिति *</label><input name="startDate" type="date" required></div>' +
        '<div class="field"><label>मासिक भाडा *</label><input name="rentAmount" type="number" min="1" value="' + u.rent + '" required></div>' +
        '<div class="field"><label>धरौटी</label><input name="depositAmount" type="number" min="0" value="0"></div>' +
        '<div class="field"><label>Private Note (सार्वजनिक हुँदैन)</label><input name="privateNote" maxlength="500"></div></div>' +
        '<div class="owner-actions"><button type="submit">भाडामा गएको Record सुरक्षित गर्नुहोस्</button></div></form>';
    }
    if (u.availability === 'RENTED') {
      return '<form id="vacateForm"><h3>🏠 कोठा खाली भयो</h3><div class="field">' +
        '<label>खाली भएको मिति *</label><input name="endDate" type="date" required></div>' +
        '<div class="owner-actions"><button type="submit">Vacate Record सुरक्षित गर्नुहोस्</button></div></form>';
    }
    if (u.availability === 'VACATED') {
      return '<form id="reactivateForm"><h3>♻ फेरि विज्ञापन सक्रिय</h3><p class="muted">पुरानै Unit ID कायम रहन्छ । Admin Review पछि सार्वजनिक हुनेछ ।</p>' +
        '<div class="field"><label>नयाँ मासिक भाडा *</label><input name="rentAmount" type="number" min="1" value="' + u.rent + '" required></div>' +
        '<div class="owner-actions"><button type="submit">Reactivation Request पठाउनुहोस्</button></div></form>';
    }
    return '<p class="owner-note">Admin Payment Verification / Approval बाँकी छ । स्वीकृत भएपछि Rental Status बदल्न सकिन्छ ।</p>';
  }

  async function openUnit(id) {
    selectedUnit = id;
    const u = currentUnit();
    if (!u) return;
    show('ownerPostPanel', false);
    show('unitPanel', true);
    $('unitTitle').textContent = u.title || u.label;
    $('unitInfo').textContent = u.unitId + ' · ' + u.availability + ' · ' + u.listingStatus;
    $('unitOperations').innerHTML = unitOperationHtml(u);
    ['rentForm', 'vacateForm', 'reactivateForm'].forEach(function (formId) {
      const form = $(formId);
      if (!form) return;
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const action = formId === 'rentForm' ? 'ownerRent' :
          formId === 'vacateForm' ? 'ownerVacate' : 'ownerReactivate';
        const button = form.querySelector('button[type="submit"]');
        await busy(button, async function () {
          try {
            const payload = Object.fromEntries(new FormData(form).entries());
            await ownerPost(Object.assign({action: action, unitId: selectedUnit}, payload));
            await loadOwner();
            await openUnit(selectedUnit);
            notice('unitMsg', 'Record सफलतापूर्वक सुरक्षित भयो ।');
          } catch (error) { notice('unitMsg', error.message, true); }
        });
      });
    });
    try {
      const history = await ownerPost({action: 'ownerHistory', unitId: id});
      $('unitHistory').innerHTML = history.map(function (h, i) {
        return '<div class="owner-unit"><strong>Rental Cycle ' + (i + 1) + '</strong><p>' +
          esc(h.startDate) + ' → ' + esc(h.endDate || 'हालसम्म') + '</p><p>' +
          money(h.rentAmount) + '/महिना · ' + esc(h.status) + '</p><small>' +
          esc(h.cycleId) + '</small></div>';
      }).join('') || '<p class="muted">अहिलेसम्म भाडामा गएको इतिहास छैन ।</p>';
    } catch (error) { notice('unitMsg', error.message, true); }
    $('unitPanel').scrollIntoView({behavior: 'smooth'});
  }

  $('closeUnit').addEventListener('click', function () { show('unitPanel', false); });

  $('uploadPhoto').addEventListener('click', function () {
    const button = this;
    busy(button, async function () {
      try {
        const file = $('ownerPhoto').files[0];
        if (!file) throw Error('पहिले फोटो छान्नुहोस् ।');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('JPG/PNG/WEBP मात्र ।');
        if (file.size > 1000000) throw Error('फोटो १ MB भन्दा सानो बनाउनुहोस् ।');
        const dataUrl = await new Promise(function (resolve, reject) {
          const reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const result = await ownerPost({
          action: 'ownerUploadPhoto', unitId: selectedUnit,
          mimeType: file.type, base64: String(dataUrl).split(',')[1]
        });
        notice('unitMsg', 'फोटो सुरक्षित भयो । जम्मा ' + result.count + ' फोटो ।');
        $('ownerPhoto').value = '';
      } catch (error) { notice('unitMsg', error.message, true); }
    });
  });

  selectOwnerAuthMode('login');
  bankInfo();
  if (ownerToken) {
    loadOwner().catch(function () {
      ownerToken = '';
      sessionStorage.removeItem('nrh_owner_token');
      show('ownerLogin', true);
    });
  }
}());
