export const HEADLINE_KEYS = [
  "civil_rights",
  "economy",
  "political_freedoms",
] as const;

export type HeadlineKey = (typeof HEADLINE_KEYS)[number];
export type PolicyValue = boolean | number | string;

export type StatDefinition = {
  key: string;
  name: string;
  category: string;
  defaultValue: number;
  min: number;
  max: number;
  headline: HeadlineKey | null;
  headlineWeight: number;
  headlineDirection: "positive" | "negative" | null;
  flavour: boolean;
};

export type PolicyDefinition = {
  key: string;
  name: string;
  category: string;
  type: "boolean" | "enum" | "number";
  options: Array<string> | null;
  min: number | null;
  max: number | null;
  defaultValue: PolicyValue;
};

export const FIXED_POLICY_VALUES: Readonly<
  Partial<Record<string, PolicyValue>>
> = {
  government_system: "presidential",
  head_of_state_type: "executive_president",
};

export function isBillMutablePolicy(key: string) {
  return !Object.hasOwn(FIXED_POLICY_VALUES, key);
}

const statGroups = {
  civil_rights:
    "Freedom of Speech|Freedom of Religion|Freedom of Assembly|Freedom of Association|Freedom of Movement|Privacy|LGBT Rights|Gender Equality|Reproductive Rights|Disability Rights|Minority Rights|Worker Rights|Consumer Rights|Digital Rights|Due Process|Prisoner Rights|Police Accountability|Access to Justice|Press Independence|Academic Freedom",
  political_freedoms:
    "Electoral Freedom|Electoral Competitiveness|Voter Participation|Government Transparency|Government Accountability|Judicial Independence|Legislative Independence|Executive Power|Local Government Autonomy|Opposition Rights|Protest Rights|Media Pluralism|Political Polarisation|Political Stability|Corruption|Lobbying Influence|Surveillance|State Secrecy|Public Trust|Civil Service Independence",
  core_economy:
    "GDP|GDP Per Capita|Economic Growth|Employment|Unemployment|Inflation|Average Income|Median Income|Income Inequality|Wealth Inequality|Poverty|Productivity|Consumer Spending|Business Confidence|Small Business Activity|Entrepreneurship|Foreign Investment|Domestic Investment|Exports|Imports|Trade Balance|Government Revenue|Government Spending|Budget Balance|National Debt|Tax Burden|Interest Rates|Cost of Living|Housing Affordability|Household Debt",
  economy_sector:
    "Manufacturing Output|Agricultural Output|Technology Output|Financial Sector|Construction Output|Retail Sector|Tourism|Energy Production|Mining Output|Fishing Output|Creative Industries|Defence Industry|Pharmaceutical Industry|Automotive Industry|Food Production|Cheese Production",
  public_services:
    "Healthcare Quality|Healthcare Accessibility|Education Quality|Education Accessibility|Public Transport Quality|Infrastructure Quality|Internet Access|Energy Reliability|Water Quality|Social Housing Availability|Welfare Generosity|Childcare Accessibility|Elderly Care Quality|Emergency Service Quality|Postal Service Quality",
  society_health:
    "Life Expectancy|Infant Mortality|Obesity|Mental Wellbeing|Alcohol Consumption|Tobacco Consumption|Drug Use|Birth Rate|Death Rate|Population Growth|Immigration|Emigration|Homelessness|Crime|Violent Crime|Property Crime|Incarceration|Police Presence|Social Mobility|Literacy|University Attendance|Working Hours|Union Membership",
  environment_energy:
    "Air Quality|Water Pollution|Carbon Emissions|Renewable Energy|Fossil Fuel Dependence|Nuclear Energy|Recycling|Biodiversity|Forest Coverage|Environmental Protection|Public Transport Usage|Car Dependency|Energy Prices|Energy Independence",
  culture_lifestyle:
    "Coffee Consumption|Tea Consumption|Beer Consumption|Cheese Consumption|Book Sales|Video Game Consumption|Cinema Attendance|Museum Attendance|Music Industry|Sports Participation|Football Popularity|Internet Usage|Social Media Usage|Average Commute|Pet Ownership|Cat Ownership|Dog Ownership|Public Drunkenness|Fast Food Consumption|Vegetarianism|Tourism Popularity|Nightlife|Happiness|Patriotism|Religiousness|Secularism",
} as const;

export function toKey(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const negativeHeadlineStats = new Set([
  "Executive Power",
  "Political Polarisation",
  "Corruption",
  "Lobbying Influence",
  "Surveillance",
  "State Secrecy",
  "Unemployment",
  "Inflation",
  "Income Inequality",
  "Wealth Inequality",
  "Poverty",
  "National Debt",
  "Cost of Living",
  "Household Debt",
]);

export const STAT_DEFINITIONS: Array<StatDefinition> = Object.entries(
  statGroups,
).flatMap(([category, names], categoryIndex) =>
  names.split("|").map((name, index) => {
    const headline =
      category === "civil_rights"
        ? "civil_rights"
        : category === "political_freedoms"
          ? "political_freedoms"
          : category === "core_economy"
            ? "economy"
            : null;
    return {
      key: toKey(name),
      name,
      category,
      defaultValue: 44 + ((index * 7 + categoryIndex * 3) % 17),
      min: 0,
      max: 100,
      headline,
      headlineWeight: headline ? 1 : 0,
      headlineDirection: headline
        ? negativeHeadlineStats.has(name)
          ? "negative"
          : "positive"
        : null,
      flavour: category === "culture_lifestyle",
    } satisfies StatDefinition;
  }),
);

const policyGroups = {
  elections_government:
    "Universal Suffrage|Compulsory Voting|Voter ID|Automatic Voter Registration|Prisoner Voting|Voting Age|Election Day Holiday|Public Election Funding|Corporate Political Donations|Individual Political Donation Limits|Foreign Political Donations|Political Advertising Regulation|Campaign Spending Limits|Term Limits|Recall Elections|Citizen Initiatives|National Referendums|Independent Electoral Commission|Independent Redistricting|Electoral System|Fixed Election Terms",
  constitutional_structure:
    "Written Constitution|Constitutional Court|Judicial Review|Separation of Powers|Federalism|Devolution|Local Government Autonomy|Upper Legislative Chamber|Head of State Type|Government System|Executive Term Limits|Emergency Powers|Constitutional Right to Protest|Constitutional Freedom of Speech|Constitutional Freedom of Religion|Constitutional Privacy Rights",
  speech_media:
    "Freedom of Speech Protections|Hate Speech Laws|Blasphemy Laws|Government Censorship|Internet Censorship|Social Media Regulation|Press Regulation|State Broadcasting|Public Broadcasting|Journalist Source Protection|Defamation Law|Flag Desecration|Book Bans|Political Satire Protection|Freedom of Information",
  privacy_policing:
    "Mass Surveillance|Facial Recognition|Internet Metadata Retention|Mandatory Digital Identification|National ID Cards|Police Body Cameras|Stop and Search Powers|Warrantless Searches|Predictive Policing|Police Militarisation|Civil Asset Forfeiture|Private Security Regulation|Right to Encryption|Mandatory Encryption Backdoors|Data Protection Law|Right to be Forgotten|Biometric Database|DNA Database",
  criminal_justice:
    "Death Penalty|Life Without Parole|Private Prisons|Prison Labour|Rehabilitation Programmes|Mandatory Minimum Sentences|Three Strikes Laws|Jury Trials|Bail System|Juvenile Justice Protections|Corporal Punishment|Solitary Confinement|Restorative Justice|Community Sentencing|Felony Disenfranchisement",
  lgbt_rights:
    "Same-sex Relationships|Same-sex Adoption|LGBT Military Service|LGBT Employment Protections|LGBT Housing Protections|LGBT Healthcare Protections|Conversion Therapy|Gender Recognition|Legal Non-binary Gender|Trans Healthcare Access|Gender-Affirming Healthcare for Minors|Bathroom Restrictions|LGBT-inclusive Education|Pride Event Restrictions|Anti-LGBT Discrimination Law",
  family_reproductive:
    "Abortion|Contraception Access|Emergency Contraception|IVF Access|Surrogacy|Divorce Law|Child Marriage|Polygamy|Parental Leave|Maternity Leave|Paternity Leave|Paid Family Leave|Child Benefit|Universal Childcare|State-funded Fertility Treatment",
  religion:
    "State Religion|Religious Education|Mandatory Religious Education|Religious Schools|Religious Tax Exemptions|Religious Dress Restrictions|Religious Symbols in Government|Secular Government|Clergy in Legislature|Faith-based Marriage Law|Apostasy Laws|Blasphemy Laws",
  drugs_substances:
    "Cannabis|Psychedelics|Cocaine|Heroin|MDMA|Other Recreational Drugs|Alcohol Prohibition|Minimum Drinking Age|Tobacco Restrictions|Smoking Ban|Vape Regulation|Alcohol Advertising Restrictions|Tobacco Advertising Restrictions|Safe Injection Sites|Drug Consumption Rooms|Needle Exchange|State-funded Addiction Treatment",
  healthcare:
    "Healthcare System|Universal Healthcare|Private Health Insurance|Prescription Drug Subsidies|Free Prescriptions|Dental Coverage|Mental Healthcare Coverage|Reproductive Healthcare|Assisted Dying|Organ Donation System|Mandatory Vaccination|Vaccine Requirements|Public Health Insurance|Medical Price Controls",
  education:
    "Free Primary Education|Free Secondary Education|University Funding Model|Student Loans|Private Schools|Religious Schools|School Vouchers|Homeschooling|Compulsory Education|Standardised Testing|Sex Education|LGBT-inclusive Education|Evolution Education|Creationism in Schools|School Uniforms|Free School Meals|State-funded Childcare",
  labour:
    "Minimum Wage|Statutory Sick Pay|Paid Holiday|Maximum Working Week|Overtime Regulation|Right to Strike|Collective Bargaining|Union Recognition|Closed Shops|Zero-hour Contracts|At-will Employment|Worker Councils|Workplace Democracy|Employee Board Representation|Severance Requirements|Unemployment Insurance|Workplace Safety Law|Equal Pay Law|Parental Leave",
  welfare:
    "Universal Basic Income|Unemployment Benefits|Disability Benefits|State Pension|Welfare Model|Housing Benefit|Child Benefit|Food Assistance|Homeless Shelters|Social Housing|Heating Assistance|Free School Meals|Guaranteed Minimum Income",
  taxation:
    "Income Tax System|Corporate Tax|Wealth Tax|Capital Gains Tax|Inheritance Tax|Sales Tax|Value-added Tax|Carbon Tax|Land Value Tax|Property Tax|Financial Transaction Tax|Digital Services Tax|Luxury Tax|Alcohol Tax|Tobacco Tax",
  business_markets:
    "Trade Policy|Capital Controls|Foreign Ownership Restrictions|Anti-monopoly Law|Price Controls|Rent Controls|Minimum Pricing|State-owned Enterprises|Privatisation|Nationalisation|Banking Regulation|Deposit Insurance|Cryptocurrency Regulation|Right to Repair|Consumer Protection|Corporate Transparency|Mandatory Corporate Audits|Worker Cooperatives",
  housing:
    "Rent Control|Public Housing|Social Housing|Right to Housing|Eviction Protections|Housing Benefit|Vacancy Tax|Second Home Tax|Foreign Property Ownership|Zoning Regulation|Density Controls|Homelessness Criminalisation|Housing First|Mortgage Subsidies",
  transport:
    "Public Transport Subsidies|Free Public Transport|Road Tolls|Congestion Charging|Fuel Tax|Electric Vehicle Subsidies|Internal Combustion Engine Ban|High-speed Rail|Railway Ownership|Bicycle Infrastructure|Mandatory Bicycle Helmets|National Speed Limit|Aviation Tax|Domestic Flight Restrictions",
  environment:
    "Carbon Tax|Emissions Trading|Net Zero Target|Coal Ban|Oil Drilling|Fracking|Offshore Drilling|Renewable Energy Subsidies|Fossil Fuel Subsidies|Plastic Bag Ban|Single-use Plastic Ban|Recycling Mandate|Deposit Return Scheme|Protected National Parks|Logging Restrictions|Fishing Quotas|Hunting Restrictions|Wildlife Protection|Environmental Impact Assessments|Clean Air Standards|Clean Water Standards",
  energy:
    "Nuclear Energy|Coal Power|Gas Power|Oil Power|Wind Power|Solar Power|Hydroelectric Power|Geothermal Power|Renewable Subsidies|Nuclear Subsidies|Energy Nationalisation|Private Energy Market|Household Energy Price Cap|Energy Export Restrictions",
  immigration_citizenship:
    "Border Policy|Points-based Immigration|Immigration Quotas|Refugee Admissions|Asylum Rights|Birthright Citizenship|Citizenship by Descent|Dual Citizenship|Citizenship Test|Language Requirement|Immigration Detention|Deportation for Serious Crime|Family Reunification|Skilled Worker Visas|Seasonal Worker Visas|Undocumented Migrant Amnesty|Voting Rights for Non-citizens|Permanent Residency Pathway",
  defence_security:
    "Conscription|Volunteer Military|Military Spending Mandate|Nuclear Weapons|Chemical Weapons|Biological Weapons|Landmines|Cluster Munitions|Arms Exports|Foreign Military Bases|Domestic Military Deployment|Military Service for Women|LGBT Military Service|Private Military Contractors|Conscientious Objection|Mandatory National Service",
  foreign_affairs:
    "Foreign Aid|Humanitarian Aid|Economic Sanctions|Arms Embargoes|Free Trade Agreements|Military Alliances|Defence Treaties|International Courts|Refugee Treaties|Climate Treaties|Foreign Election Monitoring|Overseas Development Programme",
  technology_internet:
    "Net Neutrality|Internet Censorship|Social Media Age Limits|Digital ID|Data Protection|Right to Encryption|Encryption Backdoors|Online Anonymity|Age Verification|Right to Repair|AI Regulation|Automated Decision Transparency|Facial Recognition|Government Open Data|Cryptocurrency Regulation|Digital Currency|Central Bank Digital Currency",
  firearms:
    "Civilian Gun Ownership|Handgun Ownership|Rifle Ownership|Automatic Weapons|Concealed Carry|Open Carry|Gun Registration|Background Checks|Waiting Periods|Magazine Capacity Limits|Red Flag Laws",
  food_agriculture:
    "Agricultural Subsidies|Farming Price Supports|Organic Farming Subsidies|GMO Crops|GMO Labelling|Pesticide Restrictions|Livestock Welfare Standards|Factory Farming|Foie Gras|Lab-grown Meat|Raw Milk Sales|Sugar Tax|Junk Food Advertising|School Nutrition Standards|Food Labelling|Cheese Subsidies",
} as const;

const enumPolicies: Record<string, Array<string>> = {
  "Electoral System": [
    "first_past_the_post",
    "proportional_representation",
    "ranked_choice",
    "mixed",
    "electoral_college",
  ],
  "Head of State Type": [
    "monarchy",
    "ceremonial_president",
    "executive_president",
  ],
  "Government System": ["parliamentary", "presidential", "semi_presidential"],
  "Same-sex Relationships": [
    "criminalised",
    "legal",
    "civil_unions",
    "marriage",
  ],
  "Gender Recognition": [
    "unavailable",
    "court_approval",
    "medical_requirement",
    "self_identification",
  ],
  Abortion: [
    "banned",
    "life_threat_only",
    "highly_restricted",
    "restricted",
    "legal",
    "broadly_legal",
  ],
  Cannabis: [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  Psychedelics: [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  Cocaine: [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  Heroin: [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  MDMA: [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  "Other Recreational Drugs": [
    "banned",
    "decriminalised",
    "medical_only",
    "legal_regulated",
    "legal_unregulated",
  ],
  "Healthcare System": [
    "private",
    "insurance_mandate",
    "mixed",
    "single_payer",
    "national_health_service",
  ],
  "Organ Donation System": ["opt_in", "opt_out", "mandatory"],
  "University Funding Model": ["tuition", "subsidised", "free"],
  "Welfare Model": ["minimal", "means_tested", "social_insurance", "universal"],
  "Income Tax System": ["flat", "progressive", "regressive", "none"],
  "Trade Policy": ["protectionist", "managed", "free_trade"],
  "Railway Ownership": ["private", "mixed", "public"],
  "Border Policy": ["closed", "restricted", "managed", "open"],
};

const numberPolicies: Record<string, [number, number, number]> = {
  "Voting Age": [16, 25, 18],
  "Minimum Drinking Age": [16, 25, 18],
  "Maximum Working Week": [30, 60, 40],
  "National Speed Limit": [50, 140, 100],
  "Social Media Age Limits": [10, 21, 13],
};

const seenPolicies = new Set<string>();
export const POLICY_DEFINITIONS: Array<PolicyDefinition> = Object.entries(
  policyGroups,
).flatMap(([category, names]) =>
  names.split("|").flatMap((name) => {
    const key = toKey(name);
    if (seenPolicies.has(key)) return [];
    seenPolicies.add(key);
    const options = enumPolicies[name];
    const number = numberPolicies[name];
    return [
      {
        key,
        name,
        category,
        type: options ? "enum" : number ? "number" : "boolean",
        options: options ?? null,
        min: number?.[0] ?? null,
        max: number?.[1] ?? null,
        defaultValue:
          FIXED_POLICY_VALUES[key] ??
          (options
            ? options[Math.floor(options.length / 2)]
            : number
              ? number[2]
              : false),
      } satisfies PolicyDefinition,
    ];
  }),
);

export const STAT_BY_KEY = new Map(
  STAT_DEFINITIONS.map((definition) => [definition.key, definition]),
);
export const POLICY_BY_KEY = new Map(
  POLICY_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function formatPolicyValue(value: PolicyValue) {
  if (typeof value === "boolean") return value ? "Enacted" : "Not enacted";
  if (typeof value === "number") return String(value);
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
