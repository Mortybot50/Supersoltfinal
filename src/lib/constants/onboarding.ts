export const ONBOARDING_STEPS = [
  { 
    number: 1, 
    name: 'contact_details', 
    title: 'Contact Details',
    description: 'Basic contact information and emergency contacts'
  },
  { 
    number: 2, 
    name: 'address', 
    title: 'Address',
    description: 'Residential address details'
  },
  { 
    number: 3, 
    name: 'bank_details', 
    title: 'Bank Details',
    description: 'Payment account for salary deposits'
  },
  { 
    number: 4, 
    name: 'tfn_declaration', 
    title: 'TFN Declaration',
    description: 'Tax File Number declaration (ATO required)'
  },
  { 
    number: 5, 
    name: 'super_choice', 
    title: 'Superannuation Choice',
    description: 'Select your superannuation fund'
  },
  { 
    number: 6, 
    name: 'documents', 
    title: 'Upload Documents',
    description: 'ID proof, qualifications, certifications'
  },
  { 
    number: 7, 
    name: 'policies', 
    title: 'Workplace Policies',
    description: 'Read and acknowledge company policies'
  },
  { 
    number: 8, 
    name: 'review', 
    title: 'Review & Submit',
    description: 'Review your information before submission'
  }
]

export const DOCUMENT_TYPES = [
  { value: 'id_proof', label: 'ID Proof (Passport/License)', required: true },
  { value: 'tfn_declaration', label: 'TFN Declaration', required: true },
  { value: 'super_choice', label: 'Super Choice Form', required: true },
  { value: 'bank_details', label: 'Bank Details', required: true },
  { value: 'rsa_rsg', label: 'RSA/RSG Certificate', required: false },
  { value: 'food_safety', label: 'Food Safety Certificate', required: false },
  { value: 'first_aid', label: 'First Aid Certificate', required: false },
  { value: 'training_cert', label: 'Training Certificate', required: false },
  { value: 'visa', label: 'Visa/Work Rights', required: false },
  { value: 'other', label: 'Other Document', required: false }
]

export const INVITE_EXPIRY_DAYS = 7
