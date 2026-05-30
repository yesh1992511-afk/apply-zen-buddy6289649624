// Central source of truth for all profile dropdown options.
// US-focused — companies hiring in the US ask these standard sets.

export const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Ireland", "Germany", "France",
  "Spain", "Italy", "Netherlands", "Sweden", "Norway", "Denmark", "Finland",
  "Switzerland", "Austria", "Belgium", "Portugal", "Poland", "Australia",
  "New Zealand", "Japan", "Singapore", "Hong Kong", "India", "Brazil", "Mexico",
  "Argentina", "Chile", "United Arab Emirates", "Israel", "South Africa", "Other",
];

export const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","District of Columbia","Florida","Georgia","Hawaii","Idaho","Illinois",
  "Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts",
  "Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota",
  "Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina",
  "South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington",
  "West Virginia","Wisconsin","Wyoming","Puerto Rico","Guam","U.S. Virgin Islands",
];

export const US_METROS = [
  "New York, NY","San Francisco, CA","Los Angeles, CA","Chicago, IL","Boston, MA",
  "Seattle, WA","Austin, TX","Dallas, TX","Houston, TX","Denver, CO","Atlanta, GA",
  "Washington, DC","Miami, FL","San Diego, CA","Philadelphia, PA","Phoenix, AZ",
  "Portland, OR","Minneapolis, MN","Detroit, MI","Pittsburgh, PA","Charlotte, NC",
  "Raleigh, NC","Nashville, TN","Salt Lake City, UT","Las Vegas, NV","Orlando, FL",
  "Tampa, FL","San Jose, CA","Sacramento, CA","Indianapolis, IN","Columbus, OH",
  "St. Louis, MO","Kansas City, MO","Cincinnati, OH","Cleveland, OH","Baltimore, MD",
  "Remote — US","Other",
];

export const WORK_AUTH_US = [
  "U.S. Citizen",
  "U.S. Permanent Resident (Green Card)",
  "H-1B Visa Holder",
  "H-4 EAD",
  "F-1 OPT",
  "F-1 STEM OPT",
  "F-1 CPT",
  "L-1 Visa Holder",
  "L-2 EAD",
  "TN Visa (USMCA)",
  "O-1 Visa",
  "E-3 Visa (Australia)",
  "Asylee / Refugee",
  "DACA",
  "Other — Authorized",
  "Not Authorized to Work in U.S.",
];

export const YES_NO = ["Yes", "No"];
export const YES_NO_PREFER = ["Yes", "No", "Prefer not to say"];

export const GENDER = [
  "Male", "Female", "Non-binary", "Transgender",
  "Decline to self-identify", "Prefer not to say",
];

export const PRONOUNS = [
  "he/him", "she/her", "they/them", "he/they", "she/they",
  "Other", "Prefer not to say",
];

// EEOC standard race / ethnicity categories
export const ETHNICITY_EEOC = [
  "Hispanic or Latino",
  "White (Not Hispanic or Latino)",
  "Black or African American (Not Hispanic or Latino)",
  "Asian (Not Hispanic or Latino)",
  "Native Hawaiian or Other Pacific Islander (Not Hispanic or Latino)",
  "American Indian or Alaska Native (Not Hispanic or Latino)",
  "Two or More Races (Not Hispanic or Latino)",
  "Decline to self-identify",
];

// EEOC self-identification of veteran status
export const VETERAN_STATUS = [
  "I am not a protected veteran",
  "I identify as one or more of the classifications of a protected veteran",
  "I am a disabled veteran",
  "I am a recently separated veteran",
  "I am an Active duty wartime or campaign badge veteran",
  "I am an Armed Forces service medal veteran",
  "I don't wish to answer",
];

// Section 503 of the Rehabilitation Act standard form
export const DISABILITY_STATUS = [
  "Yes, I have a disability (or previously had a disability)",
  "No, I do not have a disability",
  "I do not wish to answer",
];

export const LGBTQ_STATUS = ["Yes", "No", "Prefer not to say"];

export const REMOTE_PREFERENCE = [
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
  { value: "any", label: "Any" },
];

export const EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "Contract", "Contract-to-hire",
  "Internship", "Temporary", "Freelance",
];

export const SENIORITY = [
  "Internship", "Entry level", "Associate", "Mid-Senior level",
  "Senior", "Lead", "Staff", "Principal",
  "Manager", "Director", "VP", "C-level / Executive",
];

export const INDUSTRIES = [
  "Software / SaaS", "FinTech", "Healthcare / HealthTech", "Biotech / Pharma",
  "E-commerce / Retail", "Media / Entertainment", "Gaming", "EdTech",
  "Cybersecurity", "AI / ML", "Cloud Infrastructure", "Data / Analytics",
  "Hardware / IoT", "Robotics", "Automotive / Mobility", "Aerospace / Defense",
  "Energy / CleanTech", "Real Estate / PropTech", "Logistics / Supply Chain",
  "Manufacturing", "Consumer Goods", "Hospitality / Travel", "Government / Public Sector",
  "Non-profit", "Consulting", "Banking / Finance", "Insurance", "Legal",
  "Marketing / AdTech", "Telecommunications", "Other",
];

export const SALARY_PERIOD = [
  { value: "yearly", label: "Per year" },
  { value: "monthly", label: "Per month" },
  { value: "hourly", label: "Per hour" },
];

export const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "INR", "JPY", "CHF", "SGD"];

export const NOTICE_PERIOD_WEEKS = [
  { value: 0, label: "Immediately available" },
  { value: 1, label: "1 week" },
  { value: 2, label: "2 weeks" },
  { value: 4, label: "1 month" },
  { value: 8, label: "2 months" },
  { value: 12, label: "3 months" },
];

export const TRAVEL_WILLINGNESS = [
  "None", "Up to 10%", "Up to 25%", "Up to 50%", "Up to 75%", "100%",
];

export const SHIFT_PREFERENCE = [
  "Day shift", "Evening shift", "Night shift", "Rotating shift",
  "On-call", "Weekends", "Flexible",
];

export const SECURITY_CLEARANCE = [
  "None", "Public Trust", "Confidential", "Secret",
  "Top Secret", "TS/SCI", "TS/SCI with Polygraph",
];

export const PROFICIENCY_LANGUAGE = [
  "Native or Bilingual", "Full Professional", "Professional Working",
  "Limited Working", "Elementary",
];

export const PROFICIENCY_SKILL = ["Beginner", "Intermediate", "Advanced", "Expert"];

export const DEGREE = [
  "High School Diploma / GED",
  "Associate's Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "MBA",
  "JD (Juris Doctor)",
  "MD (Doctor of Medicine)",
  "PhD / Doctorate",
  "Bootcamp / Certificate",
  "Some College — No Degree",
  "Other",
];

export const COVER_LETTER_TONE = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
  { value: "conversational", label: "Conversational" },
];

export const HIGHEST_EDUCATION = [
  "High School", "Some College", "Associate's", "Bachelor's",
  "Master's", "MBA", "PhD", "Other",
];

// Helper for screening questions with structured options
export const SCREENING_OPTIONS: Record<string, string[]> = {
  authorized_to_work: ["Yes", "No"],
  require_sponsorship: ["No, I do not require sponsorship", "Yes, I require sponsorship now", "Yes, I will require sponsorship in the future"],
  willing_to_relocate: ["Yes", "No", "Open to discussion"],
  remote_preference: ["Remote only", "Hybrid", "On-site", "Any"],
  criminal_record: ["No", "Yes", "Prefer to discuss in interview"],
  able_to_pass_background_check: ["Yes", "No"],
  able_to_pass_drug_test: ["Yes", "No"],
  age_18_plus: ["Yes", "No"],
  highest_education: HIGHEST_EDUCATION,
};
