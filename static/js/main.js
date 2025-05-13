document.addEventListener('DOMContentLoaded', function() {
  // Card number formatting
  const cardNumberInput = document.getElementById('card_number');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function(e) {
      // Remove all non-digit characters
      let value = e.target.value.replace(/\D/g, '');
      
      // Add a space after every 4 digits
      if (value.length > 0) {
        value = value.match(/.{1,4}/g).join(' ');
      }
      
      // Update the input value
      e.target.value = value;
      
      // Validate on input
      validateCardNumber(cardNumberInput);
    });
    
    cardNumberInput.addEventListener('blur', function() {
      validateCardNumber(cardNumberInput);
    });
  }
  
  // Expiry date formatting (MM/YY)
  const expiryInput = document.getElementById('expiry_date');
  if (expiryInput) {
    expiryInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      
      if (value.length > 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
      }
      
      e.target.value = value;
      
      // Validate on input
      validateExpiryDate(expiryInput);
    });
    
    expiryInput.addEventListener('blur', function() {
      validateExpiryDate(expiryInput);
    });
  }
  
  // CVV validation
  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', function() {
      // Limit to 3-4 digits
      this.value = this.value.replace(/\D/g, '').slice(0, 4);
      validateCVV(cvvInput);
    });
    
    cvvInput.addEventListener('blur', function() {
      validateCVV(cvvInput);
    });
  }
  
  // Cardholder name validation
  const cardholderInput = document.getElementById('cardholder_name');
  if (cardholderInput) {
    cardholderInput.addEventListener('blur', function() {
      validateCardholderName(cardholderInput);
    });
  }
  
  // Amount validation
  const amountInput = document.getElementById('amount');
  if (amountInput) {
    amountInput.addEventListener('input', function() {
      // Allow only numbers and a single decimal point
      this.value = this.value.replace(/[^\d.]/g, '');
      const parts = this.value.split('.');
      if (parts.length > 2) {
        this.value = parts[0] + '.' + parts.slice(1).join('');
      }
      validateAmount(amountInput);
    });
    
    amountInput.addEventListener('blur', function() {
      validateAmount(amountInput);
    });
  }
  
  // Form validation
  const paymentForm = document.getElementById('payment-form');
  if (paymentForm) {
    paymentForm.addEventListener('submit', function(e) {
      let isValid = true;
      
      // Validate all fields
      if (cardNumberInput && !validateCardNumber(cardNumberInput)) isValid = false;
      if (expiryInput && !validateExpiryDate(expiryInput)) isValid = false;
      if (cvvInput && !validateCVV(cvvInput)) isValid = false;
      if (cardholderInput && !validateCardholderName(cardholderInput)) isValid = false;
      if (amountInput && !validateAmount(amountInput)) isValid = false;
      
      if (!isValid) {
        e.preventDefault();
        document.getElementById('validation-message').textContent = 'Please correct the errors in the form.';
        document.getElementById('validation-message').classList.remove('hidden');
      } else {
        // Show loading state
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = 'Processing...';
        }
      }
    });
  }
});

// Validation functions
function validateCardNumber(input) {
  const value = input.value.replace(/\s/g, '');
  const isValid = /^\d{15,16}$/.test(value) && luhnCheck(value);
  updateValidationUI(input, isValid, 'Please enter a valid card number');
  return isValid;
}

function validateExpiryDate(input) {
  const value = input.value;
  const isValidFormat = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(value);
  
  if (!isValidFormat) {
    updateValidationUI(input, false, 'Use MM/YY format');
    return false;
  }
  
  const [month, year] = value.split('/');
  const currentYear = new Date().getFullYear() % 100;
  const currentMonth = new Date().getMonth() + 1;
  
  const isNotExpired = (parseInt(year) > currentYear) || 
                       (parseInt(year) === currentYear && parseInt(month) >= currentMonth);
  
  updateValidationUI(input, isNotExpired, 'Card has expired');
  return isNotExpired;
}

function validateCVV(input) {
  const value = input.value;
  const isValid = /^\d{3,4}$/.test(value);
  updateValidationUI(input, isValid, 'CVV must be 3-4 digits');
  return isValid;
}

function validateCardholderName(input) {
  const value = input.value.trim();
  const isValid = value.length >= 3;
  updateValidationUI(input, isValid, 'Please enter cardholder name');
  return isValid;
}

function validateAmount(input) {
  const value = parseFloat(input.value);
  const isValid = !isNaN(value) && value > 0;
  updateValidationUI(input, isValid, 'Please enter a valid amount');
  return isValid;
}

function updateValidationUI(input, isValid, errorMessage) {
  const errorElement = input.nextElementSibling;
  
  if (isValid) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    if (errorElement && errorElement.classList.contains('form-error')) {
      errorElement.textContent = '';
    }
  } else {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
    if (errorElement && errorElement.classList.contains('form-error')) {
      errorElement.textContent = errorMessage;
    }
  }
}

// Luhn algorithm for credit card validation
function luhnCheck(cardNumber) {
  if (!cardNumber) return false;
  
  let sum = 0;
  let shouldDouble = false;
  
  // Loop through the card number from right to left
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i));
    
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  
  return sum % 10 === 0;
}

// Card type detection
function detectCardType(cardNumber) {
  const patterns = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
  };
  
  cardNumber = cardNumber.replace(/\s+/g, '');
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(cardNumber)) {
      return type;
    }
  }
  
  return 'unknown';
}