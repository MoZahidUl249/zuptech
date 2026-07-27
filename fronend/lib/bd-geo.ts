/** Upazilas (sub-districts) for each of Bangladesh's 64 districts, keyed by
 *  district name.
 *
 *  Not imported by any runtime UI anymore — the storefront/account/admin
 *  address pickers all drive the backend's live `LocationNode` tree via
 *  `GET /api/locations` (see lib/locations.ts). This file is kept only as
 *  the verified source that tree was seeded from (one-off script, not in
 *  this repo — see cal-bk.md's 2026-07-18 status update for the shape of
 *  what got created) and as a record of the research behind it, in case
 *  the tree ever needs re-seeding or auditing against this data again.
 *

 *  503 upazilas total, cross-checked against Wikipedia's "List of upazilas
 *  of Bangladesh" and Bangladeshi news coverage of the two 2026 NICAR
 *  gazettes (2026-05 and 2026-07-08) as of 2026-07-18. Includes all eight
 *  upazilas created this year: Mokamtola (Bogura), Matamuhuri (Cox's
 *  Bazar), Ruhia & Bhully (Thakurgaon), Chandraganj (Lakshmipur),
 *  Fatikchhari Uttar (Chattogram), Dakshin Gafargaon (Mymensingh) and
 *  Bangra (Cumilla). Dhaka, Chattogram, Khulna and Rajshahi districts have
 *  no "Sadar" upazila — their headquarters area is administered by a City
 *  Corporation instead, a genuine feature of Bangladesh's administrative
 *  geography, not a gap in this list. */
export const UPAZILAS_BY_DISTRICT: Record<string, string[]> = {
  "Dhaka": ["Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"],
  "Faridpur": ["Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"],
  "Gazipur": ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"],
  "Gopalganj": ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"],
  "Kishoreganj": ["Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"],
  "Madaripur": ["Dasar", "Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"],
  "Manikganj": ["Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia", "Shivalaya", "Singair"],
  "Munshiganj": ["Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar", "Tongibari"],
  "Narayanganj": ["Araihazar", "Bandar", "Narayanganj Sadar", "Rupganj", "Sonargaon"],
  "Narsingdi": ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"],
  "Rajbari": ["Baliakandi", "Goalanda", "Kalukhali", "Pangsha", "Rajbari Sadar"],
  "Shariatpur": ["Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zajira"],
  "Tangail": ["Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar"],
  "Chattogram": ["Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Fatikchhari", "Fatikchhari Uttar", "Hathazari", "Karnaphuli", "Lohagara", "Mirsharai", "Patiya", "Rangunia", "Raozan", "Sandwip", "Satkania", "Sitakunda"],
  "Bandarban": ["Ali Kadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"],
  "Brahmanbaria": ["Akhaura", "Ashuganj", "Bancharampur", "Bijoynagar", "Brahmanbaria Sadar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail"],
  "Chandpur": ["Chandpur Sadar", "Faridganj", "Haimchar", "Hajiganj", "Kachua", "Matlab Dakshin", "Matlab Uttar", "Shahrasti"],
  "Cumilla": ["Bangra", "Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Cumilla Adarsha Sadar", "Cumilla Sadar Dakshin", "Daudkandi", "Debidwar", "Homna", "Laksam", "Lalmai", "Meghna", "Monohargonj", "Muradnagar", "Nangalkot", "Titas"],
  "Cox's Bazar": ["Chakaria", "Cox's Bazar Sadar", "Eidgaon", "Kutubdia", "Maheshkhali", "Matamuhuri", "Pekua", "Ramu", "Teknaf", "Ukhia"],
  "Feni": ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"],
  "Khagrachhari": ["Dighinala", "Guimara", "Khagrachhari Sadar", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"],
  "Lakshmipur": ["Chandraganj", "Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"],
  "Noakhali": ["Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat", "Noakhali Sadar", "Senbagh", "Sonaimuri", "Subarnachar"],
  "Rangamati": ["Bagaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai", "Kawkhali", "Langadu", "Naniyachar", "Rajasthali", "Rangamati Sadar"],
  "Rajshahi": ["Bagha", "Bagmara", "Charghat", "Durgapur", "Godagari", "Mohanpur", "Paba", "Puthia", "Tanore"],
  "Bogura": ["Adamdighi", "Bogura Sadar", "Dhunat", "Dhupchanchia", "Gabtali", "Kahaloo", "Mokamtola", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatola"],
  "Joypurhat": ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"],
  "Naogaon": ["Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur", "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"],
  "Natore": ["Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Naldanga", "Natore Sadar", "Singra"],
  "Chapainawabganj": ["Bholahat", "Chapainawabganj Sadar", "Gomastapur", "Nachole", "Shibganj"],
  "Pabna": ["Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Pabna Sadar", "Santhia", "Sujanagar"],
  "Sirajganj": ["Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj", "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullahpara"],
  "Khulna": ["Batiaghata", "Dacope", "Dighalia", "Dumuria", "Koyra", "Paikgachha", "Phultala", "Rupsha", "Terokhada"],
  "Bagerhat": ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"],
  "Chuadanga": ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"],
  "Jashore": ["Abhaynagar", "Bagherpara", "Chaugachha", "Jashore Sadar", "Jhikargachha", "Keshabpur", "Manirampur", "Sharsha"],
  "Jhenaidah": ["Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"],
  "Kushtia": ["Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur"],
  "Magura": ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"],
  "Meherpur": ["Gangni", "Meherpur Sadar", "Mujibnagar"],
  "Narail": ["Kalia", "Lohagara", "Narail Sadar"],
  "Satkhira": ["Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar", "Shyamnagar", "Tala"],
  "Barishal": ["Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Barishal Sadar", "Gaurnadi", "Hizla", "Mehendiganj", "Muladi", "Uzirpur"],
  "Barguna": ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"],
  "Bhola": ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"],
  "Jhalokati": ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"],
  "Patuakhali": ["Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Mirzaganj", "Patuakhali Sadar", "Rangabali"],
  "Pirojpur": ["Bhandaria", "Indurkani", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Pirojpur Sadar"],
  "Sylhet": ["Balaganj", "Beanibazar", "Bishwanath", "Companiganj", "Dakshin Surma", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat", "Osmani Nagar", "Sylhet Sadar", "Zakiganj"],
  "Habiganj": ["Ajmiriganj", "Bahubal", "Baniyachong", "Chunarughat", "Habiganj Sadar", "Lakhai", "Madhabpur", "Nabiganj", "Shayestaganj"],
  "Moulvibazar": ["Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar", "Rajnagar", "Sreemangal"],
  "Sunamganj": ["Bishwamvarpur", "Chhatak", "Derai", "Dharamapasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Madhyanagar", "Shantiganj", "Sullah", "Sunamganj Sadar", "Tahirpur"],
  "Rangpur": ["Badarganj", "Gangachhara", "Kaunia", "Mithapukur", "Pirgachha", "Pirganj", "Rangpur Sadar", "Taraganj"],
  "Dinajpur": ["Biral", "Birampur", "Birganj", "Bochaganj", "Chirirbandar", "Dinajpur Sadar", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur", "Phulbari"],
  "Gaibandha": ["Gaibandha Sadar", "Gobindaganj", "Palashbari", "Phulchhari", "Sadullapur", "Sughatta", "Sundarganj"],
  "Kurigram": ["Bhurungamari", "Char Rajibpur", "Chilmari", "Kurigram Sadar", "Nageshwari", "Phulbari", "Rajarhat", "Raomari", "Ulipur"],
  "Lalmonirhat": ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"],
  "Nilphamari": ["Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur"],
  "Panchagarh": ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"],
  "Thakurgaon": ["Baliadangi", "Bhully", "Haripur", "Pirganj", "Ranisankail", "Ruhia", "Thakurgaon Sadar"],
  "Mymensingh": ["Bhaluka", "Dakshin Gafargaon", "Dhobaura", "Fulbaria", "Gafargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Muktagachha", "Mymensingh Sadar", "Nandail", "Phulpur", "Tarakanda", "Trishal"],
  "Jamalpur": ["Baksiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj", "Melandaha", "Sarishabari"],
  "Netrokona": ["Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Khaliajuri", "Kendua", "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala"],
  "Sherpur": ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"],
};

/** Named Thana areas inside a district's City Corporation, for the 11 of
 *  Bangladesh's 13 city corporations that have their own distinct urban
 *  thana structure (cross-checked against DMP/CMP/RMP/KMP/SMP/BMP/GCC
 *  sources and Wikipedia as of 2026-07-18). Entries that duplicate an
 *  existing upazila name in the same district (e.g. "Karnaphuli" and "Paba"
 *  are both a rural upazila AND a same-named metropolitan thana) are left
 *  out here — the upazila entry already covers that name.
 *
 *  Bogura City Corporation (approved 2026-04) still has no separate metro
 *  police/thana structure — it's policed via the existing Bogura Sadar /
 *  Shahjahanpur upazila thanas — so it has no entry of its own here.
 *  Cumilla City Corporation likewise has only one distinct urban thana
 *  (Kotwali) beyond its two Sadar upazilas. Barishal is verified down to
 *  its 4 *operational* thanas — Wikipedia lists 4 more (Rupatali, Barisal
 *  University, Char Monai, Kashipur) that have been "proposed" since 2018
 *  but never actually stood up, so they're excluded. */
export const CITY_CORP_AREAS_BY_DISTRICT: Record<string, string[]> = {
  "Dhaka": ["Adabor", "Airport", "Badda", "Banani", "Bangshal", "Bhashantek", "Cantonment", "Chawkbazar", "Dakshin Khan", "Darus-Salam", "Demra", "Dhanmondi", "Gandaria", "Gulshan", "Hatirjheel", "Hazaribagh", "Jatrabari", "Kadamtoli", "Kafrul", "Kalabagan", "Kamrangirchar", "Khilgaon", "Khilkhet", "Kotwali", "Lalbagh", "Mirpur Model", "Mohammadpur", "Motijheel", "Mugda", "New Market", "Pallabi", "Paltan Model", "Ramna Model", "Rampura", "Rupnagar", "Sabujbagh", "Shah Ali", "Shahbagh", "Shahjahanpur", "Sher-e-Bangla Nagar", "Shyampur", "Sutrapur", "Tejgaon", "Tejgaon Industrial", "Turag", "Uttar Khan", "Uttara East", "Uttara West", "Vatara", "Wari"],
  "Chattogram": ["Akbarshah", "Bakalia", "Bandar", "Bayazid", "Chandgaon", "Chawkbazar", "Double Mooring", "EPZ", "Halishahar", "Khulshi", "Kotwali", "Pahartali", "Panchlaish", "Patenga", "Sadarghat"],
  "Khulna": ["Khulna Sadar", "Sonadanga", "Khalishpur", "Daulatpur", "Khan Jahan Ali", "Labanchara", "Horintana", "Aranghata"],
  "Rajshahi": ["Boalia", "Rajpara", "Motihar", "Shah Makhdum", "Chandrima", "Kasiadanga", "Katakhali", "Belpukur", "Airport", "Karnahar", "Damkura"],
  "Sylhet": ["Kotwali", "South Surma", "Jalalabad", "Airport", "Moglabazar", "Shah Paran"],
  "Barishal": ["Kotwali", "Airport", "Kawnia", "Bandar"],
  "Rangpur": ["Kotwali", "Parshuram", "Haragach", "Tajhat", "Mahiganj", "Hazirhat"],
  "Gazipur": ["Joydebpur", "Tongi East", "Tongi West", "Bason", "Gacha", "Kashimpur", "Konabari", "Pubail"],
  "Narayanganj": ["Fatulla", "Siddhirganj"],
  "Mymensingh": ["Kotwali", "Pagla"],
  "Cumilla": ["Kotwali"],
};

/** Every selectable area for a district's Upazila/Thana field, upazilas
 *  first then City Corporation thanas (if any). */
export function areasFor(district: string): string[] {
  return [...(UPAZILAS_BY_DISTRICT[district] ?? []), ...(CITY_CORP_AREAS_BY_DISTRICT[district] ?? [])];
}

/** Same as areasFor, grouped for an <optgroup>-rendered select — a flat
 *  55-item list (Dhaka's 5 upazilas + 50 thanas) is hard to scan otherwise. */
export function groupedAreasFor(district: string): { label: string; items: string[] }[] {
  const upazilas = UPAZILAS_BY_DISTRICT[district] ?? [];
  const thanas = CITY_CORP_AREAS_BY_DISTRICT[district] ?? [];
  const groups: { label: string; items: string[] }[] = [];
  if (upazilas.length > 0) groups.push({ label: "Upazila", items: upazilas });
  if (thanas.length > 0) groups.push({ label: "City Corporation area (Thana)", items: thanas });
  return groups;
}

function isThana(district: string, area: string): boolean {
  return (CITY_CORP_AREAS_BY_DISTRICT[district] ?? []).includes(area);
}

/** Unions — the administrative tier below a rural Upazila (4,599 nationwide,
 *  total confirmed against Wikipedia's 2026-05 figure). Keyed by district
 *  then upazila, since upazila names repeat across districts (there are 4
 *  different "Kaliganj" upazilas nationwide). Sourced from the same
 *  bangladesh-geo-data dataset as the upazila list and re-keyed onto this
 *  file's Wikipedia-corrected district/upazila names; spot-checked against
 *  Wikipedia (Savar, Sylhet Sadar, Cumilla Adarsha Sadar) rather than
 *  exhaustively verified entry-by-entry the way the ~500 upazilas/thanas
 *  above were — at this volume that isn't practical, so treat these names
 *  as "very likely right, not gazette-verified". Missing for Shaistaganj
 *  (Habiganj) — no union data available in the source — and for the 8
 *  upazilas created in 2026 (Mokamtola, Matamuhuri, Ruhia, Bhully,
 *  Chandraganj, Fatikchhari Uttar, Dakshin Gafargaon, Bangra), since their
 *  unions haven't been reassigned in any source yet.
 *
 *  City Corporation Thanas have no equivalent entry here on purpose: the
 *  official next tier down is numbered Wards, but the source data only
 *  links each Ward to its City Corporation as a whole, not to a specific
 *  Thana — showing e.g. all 57 Dhaka South wards under a "Dhanmondi Thana"
 *  selection would offer mostly-wrong options, so it's better left out
 *  than shown inaccurately. The free-text Address field covers that detail
 *  for Thana-based addresses instead. */
export const UNIONS_BY_UPAZILA: Record<string, Record<string, string[]>> = {
  "Dhaka": {
    "Dhamrai": ["Amta", "Baisakanda", "Balia", "Chauhat", "Dhamrai", "Gangutia", "Jadabpur", "Kulla", "Kushura", "Nannar", "Rowail", "Sanora", "Sombhag", "Suapur", "Sutipara", "Vararia"],
    "Dohar": ["Bilaspur", "Kusumhathi", "Mahmudpur", "Muksudpur", "Narisha", "Nayabari", "Raipara", "Sutarpara"],
    "Keraniganj": ["Aganagar", "Basta", "Hazratpur", "Kalatia", "Kalindi", "Konda", "Ruhitpur", "Sakta", "Suvadda", "Taghoria", "Taranagar", "Zinzira"],
    "Nawabganj": ["Agla", "Bakshanagar", "Bandura", "Barrah", "Baruakhali", "Churain", "Galimpur", "Jantrail", "Joykrishnapur", "Kailail", "Kalakopa", "Nayansree", "Shikaripara", "Sholla"],
    "Savar": ["Aminbazar", "Ashulia", "Birulia", "Bongaon", "Dhamsona", "Kaundia", "Pathalia", "Savar", "Shimulia", "Tetuljhora", "Vakurta", "Yearpur"]
  },
  "Faridpur": {
    "Alfadanga": ["Alfadanga", "Bana", "Buraich", "Gopalpur", "Panchuria", "Tagarbanda"],
    "Bhanga": ["Algi", "Azimnagor", "Chandra", "Chumurdi", "Gharua", "Hamirdi", "Kalamridha", "Kawlibera", "Manikdha", "Nasirabad", "Nurullagonj", "Tujerpur"],
    "Boalmari": ["Boalmari", "Chandpur", "Chatul", "Dadpur", "Ghoshpur", "Gunbaha", "Moyna", "Parameshwardi", "Rupapat", "Satair", "Shekhar"],
    "Charbhadrasan": ["Char Bhadrasan", "Char Harirampur", "Char Jahukanda", "Gazirtek"],
    "Faridpur Sadar": ["Aliabad", "Ambikapur", "Charmadbdia", "Decreerchar", "Greda", "Ishangopalpur", "Kaijuri", "Kanaipur", "Krishnanagar", "Majchar", "Uttarchannel"],
    "Madhukhali": ["Bagat", "Dumain", "Gazna", "Jahapur", "Kamarkhali", "Madhukhali", "Megchami", "Nowpara", "Raipur"],
    "Nagarkanda": ["Charjashordi", "Dangi", "Fulsuti", "Kaichail", "Kodalia Shohidnagar", "Laskardia", "Purapara", "Ramnagar", "Talma"],
    "Sadarpur": ["Akoter Char", "Bhashanchar", "Char Bisnopur", "Char Manair", "Char Nasirpur", "Dhaukhali", "Krishnapur", "Narikel Bariya", "Sadarpur"],
    "Saltha": ["Atghar", "Ballabhdi", "Bhawal", "Gatti", "Jadunandi", "Mazadia", "Ramkantapur", "Sonapur"]
  },
  "Gazipur": {
    "Gazipur Sadar": ["Baria", "Basan", "Gachha", "Kashimpur", "Kayaltia", "Konabari", "Mirzapur", "Pubail"],
    "Kaliakair": ["Atabaha", "Boali", "Chapair", "Dhaliora", "Fulbaria", "Madhyapara", "Mouchak", "Srifaltali", "Sutrapur"],
    "Kaliganj": ["Bahadursadi", "Baktarpur", "Jamalpurnew", "Jangalia", "Moktarpur", "Nagari", "Tumulia"],
    "Kapasia": ["Barishaba", "Chandpur", "Durgapur", "Ghagotia", "Kapasia", "Karihata", "Rayed", "Sinhasree", "Sonmania", "Targoan", "Tokh"],
    "Sreepur": ["Barmi", "Gazipur", "Gosinga", "Kaoraid", "Maona", "Prahladpur", "Rajabari", "Telihati"]
  },
  "Gopalganj": {
    "Gopalganj Sadar": ["Borashi", "Boultali", "Chandradighalia", "Durgapur", "Gobra", "Gopinathpur", "Horidaspur", "Jalalabad", "Kajulia", "Karpara", "Kati", "Lotifpur", "Majhigati", "Nizra", "Paikkandi", "Roghunathpur", "Sahapur", "Satpar", "Shuktail", "Ulpur", "Urfi"],
    "Kashiani": ["Bethuri", "Fukura", "Hatiara", "Kashiani", "Maheshpur", "Mamudpur", "Nijamkandi", "Orakandia", "Parulia", "Puisur", "Rajpat", "Ratail", "Sajail", "Singa"],
    "Kotalipara": ["Amtoli", "Bandhabari", "Ghaghor", "Hiron", "Kandi", "Kolabari", "Kushla", "Pinjuri", "Radhaganj", "Ramshil", "Sadullapur"],
    "Muksudpur": ["Banshbaria", "Batikamari", "Bohugram", "Dignagar", "Gobindopur", "Gohala", "Jalirpar", "Kashalia", "Khandarpara", "Mochna", "Moharajpur", "Nanikhir", "Poshargati", "Raghdi", "Ujani", "Vabrashur"],
    "Tungipara": ["Borni", "Dumaria", "Gopalpur", "Kushli", "Patgati"]
  },
  "Kishoreganj": {
    "Austagram": ["Adampur", "Austagram Sadar", "Bangalpara", "Dewghar", "Kalma", "Kastul", "Khyerpur-Abdullahpur", "Purba Austagram"],
    "Bajitpur": ["Boliardi", "Dighirpar", "Dilalpur", "Gazirchar", "Halimpur", "Hilochia", "Homypur", "Kailag", "Maijchar9", "Pirijpur", "Sararchar"],
    "Bhairab": ["Aganagar", "Gajaria", "Kalika Prashad", "Sadekpur", "Shibpur", "Shimulkandi", "Sreenagar"],
    "Hossainpur": ["Araibaria", "Gobindapur", "Jinari", "Pumdi", "Sahedal", "Sidhla"],
    "Itna": ["Alonjori", "Badla", "Boribari", "Chawganga", "Dhonpur", "Itna", "Joysiddi", "Mriga", "Raytoti"],
    "Karimganj": ["Barogharia", "Dehunda", "Gujadia", "Gunodhar", "Joyka", "Kadirjangal", "Kiraton", "Niamatpur", "Noabad", "Sutarpara", "Zafrabad"],
    "Katiadi": ["Acmita", "Banagram", "Chandpur", "Jalalpur", "Kargaon", "Lohajuree", "Mosua", "Mumurdia", "Shahasram Dhuldia"],
    "Kishoreganj Sadar": ["Binnati", "Bowlai", "Chowddoshata", "Danapatuli", "Joshodal", "Karshakarial", "Latibabad", "Maizkhapan", "Maria", "Mohinanda", "Rashidabad"],
    "Kuliarchar": ["Chhaysuti", "Faridpur", "Gobaria Abdullahpur", "Osmanpur", "Ramdi", "Salua"],
    "Mithamain": ["Bairati", "Dhaki", "Ghagra", "Gopdighi", "Katkhal", "Keoarjore", "Mithamoin"],
    "Nikli": ["Chatirchar", "Dampara", "Guroi", "Jaraitala", "Karpasa", "Nikli Sadar", "Singpur"],
    "Pakundia": ["Burudia", "Chandipasha", "Charfaradi", "Egarasindur", "Hosendi", "Jangalia", "Narandi", "Pakundia", "Patuavabga", "Shukhia"],
    "Tarail": ["Damiha", "Dhola", "Digdair", "Jawar", "Rauti", "Taljanga", "Tarail-Sachail"]
  },
  "Madaripur": {
    "Dasar": ["Bahubal", "Dasar", "Dighi", "Kanthaldi", "Palong"],
    "Kalkini": ["Alinagar", "Baligram", "Basgari", "Chardoulatkhan", "Dashar", "Enayetnagor", "Gopalpur", "Kazibakai", "Koyaria", "Laxmipur", "Nabogram", "Ramjanpur", "Shahebrampur", "Shikarmongol"],
    "Madaripur Sadar": ["Bahadurpur", "Chilarchar", "Dhurail", "Dudkhali", "Ghatmajhi", "Jhaoudi", "Kalikapur", "Kandua", "Khoajpur", "Kunia", "Mastofapur", "Panchkhola", "Peyarpur", "Rasti", "Sirkhara"],
    "Rajoir": ["Amgram", "Badarpasa", "Bajitpur", "Haridasdi-Mahendrodi", "Hosenpur", "Ishibpur", "Kabirajpur", "Kadambari", "Khaliya", "Paikpara", "Rajoir"],
    "Shibchar": ["Baheratala North", "Bahertala South", "Bandarkhola", "Baskandi", "Charjanazat", "Dattapara", "Ditiyakhando", "Kadirpur", "Kathalbari", "Kutubpur", "Madbarerchar", "Nilokhe", "Panchar", "Sannasirchar", "Shibchar", "Shiruail", "Umedpur", "Vhadrasion", "Vhandarikandi"]
  },
  "Manikganj": {
    "Daulatpur": ["Bachamara", "Baghutia", "Chakmirpur", "Charkataree", "Dhamswar", "Khalshi", "Klia", "Zionpur"],
    "Ghior": ["Baliyakhora", "Baniazuri", "Bartia", "Gior", "Nalee", "Paila", "Shingzuri"],
    "Harirampur": ["Azimnagar", "Baira", "Balla", "Blara", "Chala", "Dhulsura", "Gala", "Gopinathpur", "Harukandi", "Kanchanpur", "Lacharagonj", "Ramkrishnapur", "Sutalorie"],
    "Manikganj Sadar": ["Atigram", "Betila-Mitara", "Dighi", "Garpara", "Hatipara", "Jagir", "Krishnapur", "Nbogram", "Putile", "Vararia"],
    "Saturia": ["Baliyati", "Baried", "Dargram", "Dhankora", "Dighulia", "Fukurhati", "Hargaj", "Saturia", "Tilli"],
    "Shivalaya": ["Aruoa", "Mohadebpur", "Shibaloy", "Shimulia", "Teota", "Ulayel", "Utholi"],
    "Singair": ["Baldhara", "Buyra", "Chandhar", "Charigram", "Dhalla", "Jamirta", "Joymonto", "Shayesta", "Singiar", "Talebpur", "Zamsha"]
  },
  "Munshiganj": {
    "Gazaria": ["Baluakandi", "Baushia", "Gajaria", "Guagachia", "Hosendee", "Imampur", "Tengarchar", "Vaberchar"],
    "Lohajang": ["Baultoli", "Bejgaon", "Gaodia", "Haldia", "Kalma", "Kanaksar", "Khidirpara", "Kumarbhog", "Lohajang-Teotia", "Medinimandal"],
    "Munshiganj Sadar": ["Adhara", "Bajrajogini", "Banglabazar", "Charkewar", "Mohakali", "Mollakandi", "Panchashar", "Rampal", "Shiloy"],
    "Sirajdikhan": ["Bairagadi", "Baluchar", "Basail", "Chitracoat", "Ichhapura", "Joyinshar", "Keyain", "Kola", "Latabdi", "Madhypara", "Malkhanagar", "Rajanagar", "Rasunia", "Sekhornagar"],
    "Sreenagar": ["Atpara", "Bagra", "Baraikhali", "Birtara", "Hashara", "Kolapara", "Kukutia", "Patabhog", "Rarikhal", "Shamshiddi", "Shologhor", "Sreenagar", "Tantor", "Vaggakol"],
    "Tongibari": ["Abdullapur", "Arial Baligaon", "Autshahi", "Betka", "Dhipur", "Dighirpar", "Hasailbanari", "Joslong", "Kamarkhara", "Kathadia Shimolia", "Panchgaon", "Sonarong Tongibari"]
  },
  "Narayanganj": {
    "Araihazar": ["Bishnandi", "Brahammandi", "Duptara", "Fatepur", "Highjadi", "Kagkanda", "Kalapaharia", "Mahmudpur", "Satgram", "Uchitpura"],
    "Bandar": ["Bandar", "Bandar", "Dhamgar", "Dhamgar", "Enayetnagar", "Kalagachhia", "Kolagathia", "Modonpur", "Murapara", "Musapur"],
    "Narayanganj Sadar": ["Alirtek", "Baktaboli", "Enayetnagor", "Gognagar", "Kashipur", "Kutubpur"],
    "Rupganj": ["Bholobo", "Bhulta", "Daudpur", "Golakandail", "Kayetpara", "Murapara", "Rupganj"],
    "Sonargaon": ["Baidyerbazar", "Baradi", "Jampur", "Kanchpur", "Mograpara", "Noagaon", "Pirojpur", "Sadipur", "Shambhupura", "Sonmandi"]
  },
  "Narsingdi": {
    "Belabo": ["Amlaba", "Bajnaba", "Belabo", "Binnabayd", "Charuzilab", "Diara", "Naraynpur", "Patuli", "Sallabad"],
    "Monohardi": ["Barachapa", "Chalakchar", "Chandanbari", "Charmandalia", "Dawlatpur", "Ekduaria", "Gotashia", "Kanchikata", "Khidirpur", "Krisnopur", "Labutala", "Shukundi"],
    "Narsingdi Sadar": ["Alokbali", "Amdia", "Chardighaldi", "Chinishpur", "Hajipur", "Karimpur", "Khathalia", "Mahishasura", "Meherpara", "Nazarpur", "Nuralapur", "Paikarchar", "Panchdona", "Silmandi"],
    "Palash": ["Charsindur", "Danga", "Gazaria", "Jinardi"],
    "Raipura": ["Adiabad", "Alipura", "Amirganj", "Banshgari", "Chanderkandi", "Chanpur", "Chararalia", "Charmadhua", "Charsubuddi", "Daukarchar", "Hairmara", "Maheshpur", "Marjal", "Mirzanagar", "Mirzarchar", "Musapur", "Nilakhya", "Palashtali", "Paratali", "Roypura", "Sreenagar", "Uttar Bakharnagar"],
    "Shibpur": ["Ayubpur", "Baghabo", "Chakradha", "Dulalpur", "Joshar", "Joynagar", "Masimpur", "Putia", "Sadharchar"]
  },
  "Rajbari": {
    "Baliakandi": ["Baharpur", "Baliakandi", "Islampur", "Jamalpur", "Janjal", "Narua", "Nawabpur"],
    "Goalanda": ["Chotovakla", "Debugram", "Doulatdia", "Uzancar"],
    "Kalukhali": ["Boalia", "Kalikapur", "Kalukhali", "Madapur", "Majbari", "Mrigi", "Ratandia", "Shawrail"],
    "Pangsha": ["Babupara", "Bahadurpur", "Habashpur", "Jashai", "Kalimahar", "Kasbamajhail", "Machhpara", "Mourat", "Patta", "Sarisha"],
    "Rajbari Sadar": ["Alipur", "Banibaha", "Basantapur", "Borat", "Chandoni", "Dadshee", "Khangonj", "Khankhanapur", "Mijanpur", "Mulghar", "Panchuria", "Ramkantapur", "Shahidwahabpur", "Sultanpur"]
  },
  "Shariatpur": {
    "Bhedarganj": ["Arsinagar", "Charkumaria", "Charsensas", "Charvaga", "D.M Khali", "Kachikata", "Mahisar", "Narayanpur", "North Tarabunia", "Ramvadrapur", "Sakhipur", "Saygaon", "South Tarabunia"],
    "Damudya": ["Dankati", "Darulaman", "Islampur", "Kaneshar", "Purba Damudya", "Shidulkura", "Sidya"],
    "Gosairhat": ["Alaolpur", "Edilpur", "Goshairhat", "Kodalpur", "Kuchipatti", "Nager Para", "Nalmuri", "Samontasar"],
    "Naria": ["Bijari", "Charatra", "Dingamanik", "Fategongpur", "Garishar", "Japsa", "Kedarpur", "Moktererchar", "Nashason", "Nowpara", "Rajnagar", "Vojeshwar", "Vumkhara"],
    "Shariatpur Sadar": ["Angaria", "Binodpur", "Chandrapur", "Chikondi", "Chitolia", "Domshar", "Mahmudpur", "Palong", "Rudrakar", "Shulpara", "Tulasar"],
    "Zajira": ["Barogopalpur", "Barokandi", "Bilaspur", "Bknagar", "Jaynagor", "Kundarchar", "Mulna", "Nawdoba", "Palerchar", "Purba Nawdoba", "Shenerchar", "Zajira Sadar"]
  },
  "Tangail": {
    "Basail": ["Basail", "Fulki", "Habla", "Kanchanpur", "Kashil", "Kauljani"],
    "Bhuapur": ["Aloa", "Arjuna", "Falda", "Gabshara", "Gobindashi", "Nikrail"],
    "Delduar": ["Atia", "Delduar", "Deuli", "Dubail", "Elasin", "Fazilhati", "Lauhati", "Patharail"],
    "Dhanbari": ["Baniajan", "Birtara", "Bolibodrow", "Dhopakhali", "Jadunathpur", "Mushuddi", "Paiska"],
    "Ghatail": ["Anehola", "Deopara", "Deulabari", "Dhalapara", "Digar", "Dighalkandia", "Ghatail", "Jamuria", "Lokerpara", "Rasulpur", "Sandhanpur"],
    "Gopalpur": ["Alamnagor", "Dhopakandi", "Hadera", "Hemnagor", "Jhawail", "Mirzapur", "Nagdashimla"],
    "Kalihati": ["Balla", "Bangra", "Birbashinda", "Dashokia", "Durgapur", "Gohaliabari", "Kokdahara", "Nagbari", "Narandia", "Paikora", "Parkhi", "Salla", "Shahadebpur"],
    "Madhupur": ["Alokdia", "Aronkhola", "Aushnara", "Golabari", "Mirjabari", "Sholakuri"],
    "Mirzapur": ["Ajgana", "Anaitara", "Bahuria", "Banail", "Baora", "Bastail", "Bhatram", "Fatepur", "Gorai", "Jamurki", "Latifpur", "Mahera", "Tarafpur", "Warshi"],
    "Nagarpur": ["Bekrah Atgram", "Bhadra", "Bharra", "Dhuburia", "Doptior", "Goyhata", "Mamudnagor", "Mokna", "Nagorpur", "Pakutia", "Sahabathpur", "Solimabad"],
    "Sakhipur": ["Baharatoil", "Dariapur", "Gajaria", "Hatibandha", "Jaduppur", "Kakrajan", "Kalia", "Kalmegha"],
    "Tangail Sadar": ["Baghil", "Dyenna", "Gala", "Gharinda", "Hugra", "Kakua", "Karatia", "Katuli", "Mahamudnagar", "Mogra", "Porabari", "Silimpur"]
  },
  "Chattogram": {
    "Anwara": ["Anwara", "Barasat", "Baroakhan", "Barumchara", "Battali", "Boirag", "Chatari", "Haildhar", "Juidandi", "Paraikora", "Raipur"],
    "Banshkhali": ["Baharchhara", "Bailchhari", "Chambal", "Chhanua", "Gandamara", "Kalipur", "Katharia", "Khankhanabad", "Puichhari", "Pukuria", "Sadhanpur", "Saral", "Sekherkhil", "Silk"],
    "Boalkhali": ["Ahla Karaldenga", "Amuchia", "Charandwi", "Kandhurkhil", "Pashchim Gamdandi", "Popadia", "Purba Gomdandi", "Sakpura", "Saroatali", "Sreepur-Kharandwi"],
    "Chandanaish": ["Bailtali", "Barama", "Barkal", "Dhopachhari", "Dohazari", "Hashimpur", "Joara", "Kanchanabad", "Satbaria"],
    "Fatikchhari": ["Abdullapur", "Baganbazar", "Bhujpur", "Bokhtapur", "Dantmara", "Daulatpur", "Dharmapur", "Harualchari", "Jafathagar", "Kanchannagor", "Lelang", "Nanupur", "Narayanhat", "Paindong", "Roshangiri", "Samitirhat", "Suabil", "Sunderpur"],
    "Hathazari": ["Budirchar", "Chikondandi", "Chipatali", "Dakkin Madrasha", "Dhalai", "Farhadabad", "Fathepur", "Garduara", "Gomanmordan", "Hathazari", "Mekhal", "Mirjapur", "Nangolmora", "Sikarpur", "Uttar Madrasha"],
    "Karnaphuli": ["Barauthan", "Char Lakshya", "Char Patharghata", "Juldha", "Sikalbaha"],
    "Lohagara": ["Adhunagar", "Amirabad", "Barahatia", "Charamba", "Chunati", "Kalauzan", "Lohagara", "Padua", "Putibila"],
    "Mirsharai": ["Dhoom", "Durgapur", "Haitkandi", "Hinguli", "Ichakhali", "Jorarganj", "Katachhara", "Khaiyachhara", "Korerhat", "Maghadia", "Mayani", "Mirsharai", "Mithanala", "Osmanpur", "Saherkhali", "Wahedpur"],
    "Patiya": ["Asia", "Bara Uthan", "Baralia", "Bhatikhain", "Chanhara", "Char Lakshya", "Char Patharghata", "Dakkhin Bhurshi", "Dhalghat", "Habilasdwi", "Haidgaon", "Janglukhain", "Jiri", "Juldha", "Kachuai", "Kasiais", "Kelishahar", "Kharana", "Kolagaon", "Kusumpura", "Sikalbaha", "Sobhandandi"],
    "Rangunia": ["Betagi", "Chandraghona", "Hosnabad", "Islampur", "Kodala", "Lalanagar", "Mariumnagar", "Parua", "Pomra", "Rajanagar", "Sharafbhata", "Shilok", "South Rajanagar", "Swanirbor Rangunia"],
    "Raozan": ["Bagoan", "Binajuri", "Chikdair", "Dabua", "Gohira", "Holdia", "Kodolpur", "Noapara", "Nowajushpur", "Pahartali", "Paschim Gujra", "Purbagujra", "Raozan", "Urkirchar"],
    "Sandwip": ["Amanullah", "Azimpur", "Bauria", "Gachhua", "Haramia", "Harispur", "Kalapania", "Magdhara", "Maitbhanga", "Musapur", "Rahmatpur", "Santoshpur", "Sarikait", "Urirchar"],
    "Satkania": ["Amilaisi", "Bazalia", "Charati", "Dhemsa", "Eochiai", "Kaliais", "Kanchana", "Keochia", "Khagaria", "Madarsa", "Nalua", "Paschim Dhemsa", "Puranagar", "Sadaha", "Satkania", "Sonakania"],
    "Sitakunda": ["Banshbaria", "Barabkunda", "Bariadyala", "Bhatiari", "Kumira", "Muradpur", "Saidpur", "Salimpur", "Sonaichhari"]
  },
  "Bandarban": {
    "Ali Kadam": ["Alikadam", "Alikadam Sadar", "Chwekhyong"],
    "Bandarban Sadar": ["Bandarban Sadar", "Kuhalong", "Rajbila", "Suwalok", "Tongkaboty"],
    "Lama": ["Aziznagar", "Fasiakhali", "Fythong", "Gajalia", "Lama Sadar", "Rupushipara", "Sarai"],
    "Naikhongchhari": ["Baishari", "Duwchari", "Gumdhum", "Naikhyongchari Sadar", "Sonaychari"],
    "Rowangchhari": ["Alekyong", "Nawapotong", "Rowangchari Sadar", "Rowangchhari", "Taracha"],
    "Ruma": ["Galanggya", "Paind", "Ramakreprangsa", "Ruma", "Ruma Sadar"],
    "Thanchi": ["Balipara", "Remakre", "Thanchi", "Thanchi Sadar", "Tind"]
  },
  "Brahmanbaria": {
    "Akhaura": ["Akhauran", "Akhauras", "Dharkhar", "Mogra", "Monionda"],
    "Ashuganj": ["Araishidha", "Ashuganj", "Charchartala", "Durgapur", "Lalpur", "Sarifpur", "Talshaharw", "Tarua"],
    "Bancharampur": ["Ayabpur", "Bancharampur", "Dariadulat", "Darikandi", "Fardabad", "Manikpur", "Pahariya Kandi", "Rupushdi", "Saifullyakandi", "Salimabad", "Sonarampur", "Tazkhali", "Ujanchar"],
    "Bijoynagar": ["Bhudanty", "Bishupor", "Champaknagar", "Chandura", "Charislampur", "Harashpur", "Ichapura", "Paharpur", "Pattan", "Singerbil"],
    "Brahmanbaria Sadar": ["Basudeb", "Bodhal", "Machihata", "Majlishpur", "Natai", "Natai", "Ramrail", "Sadekpur", "Shuhilpur", "Sultanpur", "Talsahar"],
    "Kasba": ["Badair", "Bayek", "Benauty", "Gopinathpur", "Kasbaw", "Kayempur", "Kharera", "Kuti", "Mehari", "Mulagram"],
    "Nabinagar": ["Barail", "Barikandi", "Biddayakut", "Birgaon", "Bitghar", "Ibrahimpur", "Jinudpur", "Kaitala (North)", "Kaitala (South)", "Krishnanagar", "Laurfatehpur", "Nabinagare", "Nabinagarw", "Nathghar", "Rasullabad", "Ratanpur", "Salimganj", "Satmura", "Shamogram", "Shibpur", "Sreerampur"],
    "Nasirnagar": ["Bhalakut", "Burishwar", "Chapartala", "Chatalpar", "Dharnondol", "Fandauk", "Goalnagar", "Gokarna", "Goniauk", "Haripur", "Kunda", "Nasirnagar", "Purbabhag"],
    "Sarail": ["Auraol", "Chunta", "Kalikaccha", "Noagoun", "Pakshimuul", "Panishor", "Sarail", "Shahajadapur", "Shahbazpur"]
  },
  "Chandpur": {
    "Chandpur Sadar": ["Ashikati", "Baghadi", "Balia", "Bishnapur", "Chandra", "Hanarchar", "Ibrahimpur", "Kalyanpur", "Laxmipur Model", "Maishadi", "Rajrajeshwar", "Rampur", "Shahmahmudpur", "Tarpurchandi"],
    "Faridganj": ["Balithuba (East)", "Balithuba (West)", "Chardukhia (East)", "Chardukhia (West)", "Faridgonj (South)", "Gobindapur (North)", "Gobindapur (South)", "Gupti (East)", "Gupti (West)", "Paikpara (North)", "Paikpara (South)", "Rupsha (North)", "Rupsha (South)", "Subidpur (East)", "Subidpur (West)"],
    "Haimchar": ["Algidurgapur (North)", "Algidurgapur (South)", "Charbhairabi", "Gazipur", "Haimchar", "Nilkamal"],
    "Hajiganj": ["Bakila", "Barkul (East)", "Barkul (West)", "Gandharbapur (North)", "Gandharbapur (South)", "Hajiganj Sadar", "Hatila (East)", "Hatila (West)", "Kalocho (North)", "Kalocho (South)", "Rajargaon (North)"],
    "Kachua": ["Ashrafpur", "Bitara", "Gohat (North)", "Gohat (South)", "Kachua (North)", "Kachua (South)", "Kadla", "Koroia", "Pathair", "Sachar", "Shohodebpur (East)", "Shohodebpur (West)"],
    "Matlab Dakshin": ["Khadergaon", "Narayanpur", "Nayergaon (North)", "Nayergaon (South)", "Upadi (North)", "Upadi (South)"],
    "Matlab Uttar": ["Banganbari", "Durgapur", "Eklaspur", "Farajikandi", "Fatehpur (East)", "Fatehpur (West)", "Gazra", "Islamabad", "Jahirabad", "Kalakanda", "Mohanpur", "Sadullapur", "Satnal", "Sultanabad"],
    "Shahrasti": ["Chitoshi (East)", "Chitoshiwest", "Meher (North)", "Meher (South)", "Raysree (North)", "Raysree (South)", "Suchipara (North)", "Suchipara (South)", "Tamta (North)", "Tamta (South)"]
  },
  "Cumilla": {
    "Barura": ["Adda", "Adra", "Aganagar", "Bhabanipur", "Bhaukshar", "Chitodda", "Galimpur", "Jhalam", "Laxmipur", "North Khoshbas", "North Shilmuri", "Payalgacha", "Shakpur", "South Khoshbas", "South Shilmuri"],
    "Brahmanpara": ["Brahmanpara Sadar", "Chandla", "Dulalpur", "Madhabpur", "Malapara", "Shahebabad", "Shashidal", "Shidli"],
    "Burichang": ["Bakshimul", "Burichang Sadar", "Mokam", "Moynamoti", "Pirjatrapur", "Rajapur", "Sholonal", "Varella"],
    "Chandina": ["Barera", "Bataghashi", "Borcarai", "Borcoit", "Dollai Nowabpur", "Etberpur", "Gollai", "Joag", "Keronkhal", "Madhaiya", "Maijkhar", "Mohichial", "Shuhilpur"],
    "Chauddagram": ["Alkara", "Batisha", "Cheora", "Ghulpasha", "Goonabati", "Jagannatdighi", "Kalikapur", "Kankapait", "Kashinagar", "Moonshirhat", "Shuvapur", "Sreepur"],
    "Cumilla Adarsha Sadar": ["Amratoli", "Jagannatpur", "Kalirbazer", "North Durgapur", "Panchthubi", "South Durgapur"],
    "Cumilla Sadar Dakshin": ["Bagmara (North)", "Bagmara (South)", "Baropara", "Belgor (North)", "Belgor (South)", "Bhuloin (North)", "Bhuloin (South)", "Bijoypur", "Chuwara", "Goliara", "Jorkanoneast", "Jorkanonwest", "Perul (North)", "Perul (South)"],
    "Daudkandi": ["Baropara", "Betessor", "Daudkandi", "Doulotpur", "East Mohammadpur", "Goalmari", "Gouripur", "Maruka", "North Eliotgonj", "Podua", "South Eliotgonj", "Sundolpur", "West Mohammadpur", "West Passgacia", "Zinglatoli"],
    "Debidwar": ["Barkamta", "Boroshalghor", "Dhampti", "Elahabad", "Fatehabad", "Jafargonj", "Mohanpur", "North Gunaighor", "Rajameher", "Rasulpur", "South Gunaighor", "Subil", "Sultanpur", "Vani", "Yousufpur"],
    "Homna": ["Asadpur", "Chanderchor", "Dulalpur", "Gagutiea", "Garmora", "Joypur", "Mathabanga", "Nilokhi", "Vashania"],
    "Laksam": ["Azgora", "Bakoi", "Gobindapur", "Kandirpar", "Laksam Purba", "Mudafargonj", "Uttarda"],
    "Lalmai": ["Bagmara (North)", "Bagmara (South)", "Belgor (North)", "Belgor (South)", "Bhuloin (North)", "Bhuloin (South)", "Perul (North)", "Perul (South)"],
    "Meghna": ["Barakanda", "Chalibanga", "Chandanpur", "Govindapur", "Luterchar", "Manikarchar", "Radanagar", "Vaorkhola"],
    "Monohargonj": ["Baishgaon", "Bipulashar", "Hasnabad", "Jholam (North)", "Jholam (South)", "Khela", "Lokkhanpur", "Moishatua", "Natherpetua", "Shoroshpur", "Uttarhowla"],
    "Muradnagar": ["Akubpur", "Andicot", "Babutipara", "Bangara (East)", "Bangara (West)", "Camalla", "Chapitala", "Damgar", "Darura", "Jahapur", "Jatrapur", "Muradnagar Sadar", "Nobipur (East)", "Nobipur (West)", "Paharpur", "Purbadair (East)", "Purbadair (West)", "Ramachandrapur (North)", "Ramachandrapur (South)", "Salikandi", "Sreekil", "Tanki"],
    "Nangalkot": ["Adra", "Bangadda", "Boxgonj", "Dhalua", "Doulkha", "Heshakhal", "Judda", "Makrabpur", "Mokara", "Paria", "Raykot", "Satbaria"],
    "Titas": ["Balorampur", "Jagatpur", "Kalakandi", "Karikandi", "Majidpur", "Narayandia", "Satani", "Vitikandi", "Zearkandi"]
  },
  "Cox's Bazar": {
    "Chakaria": ["Badarkhali", "Bamobil Chari", "Baraitali", "Bheola Manik Char", "Chiringa", "Demusia", "Dulahazara", "Fashiakhali", "Harbang", "Kaiar Bil", "Kakhara", "Khuntakhali", "Konakhali", "Paschim Bara Bheola", "Saharbil", "Surajpur Manikpur"],
    "Cox's Bazar Sadar": ["Chowfaldandi", "Eidgaon", "Islamabad", "Islampur", "Jalalabad", "Jhilongjha", "Khurushkhul", "Pmkhali", "Pokkhali", "Varuakhali"],
    "Eidgaon": ["Chowfaldondi", "Eidgaon", "Islam Abad", "Jalalabad", "Pokkhali"],
    "Kutubdia": ["Ali Akbar Deil", "Baragho", "Dakshi Dhurung", "Kaiyarbil", "Lemsikhali", "Uttar Dhurung"],
    "Maheshkhali": ["Boro Moheshkhali", "Choto Moheshkhali", "Dhalghata", "Hoanak", "Kalarmarchhara", "Kutubjum", "Matarbari", "Shaplapur"],
    "Pekua": ["Barabakia", "Magnama", "Pekua", "Rajakhali", "Shilkhali", "Taitong", "Ujantia"],
    "Ramu": ["Chakmarkul", "Dakkhin Mithachhari", "Eidghar", "Fotekharkul", "Garjoniya", "Jouarianala", "Kacchapia", "Kauwarkho", "Khuniapalong", "Rajarkul", "Rashidnagar"],
    "Teknaf": ["Baharchara", "Hnila", "Saintmartin", "Subrang", "Teknaf Sadar", "Whykong"],
    "Ukhia": ["Holdiapalong", "Jaliapalong", "Palongkhali", "Rajapalong", "Ratnapalong"]
  },
  "Feni": {
    "Chhagalnaiya": ["Gopal", "Mohamaya", "Pathannagar", "Radhanagar", "Subhapur"],
    "Daganbhuiyan": ["Daganbhuiyan", "Jayloskor", "Matubhuiyan", "Purbachandrapur", "Rajapur", "Ramnagar", "Sindurpur", "Yeakubpur"],
    "Feni Sadar": ["Baligaon", "Chonua", "Dholia", "Dhormapur", "Fazilpur", "Forhadnogor", "Kalidah", "Kazirbag", "Lemua", "Motobi", "Panchgachia", "Sarishadi"],
    "Fulgazi": ["Amzadhat", "Anandopur", "Dorbarpur", "Fulgazi", "Gmhat", "Munshirhat"],
    "Parshuram": ["Boxmahmmud", "Bulachara", "Ctholia", "Mizanagar", "Parshuram", "Salikha"],
    "Sonagazi": ["Amirabad", "Bogadana", "Chardorbesh", "Charmozlishpur", "Chorchandia", "Mongolkandi", "Motigonj", "Nababpur", "Sonagazi"]
  },
  "Khagrachhari": {
    "Dighinala": ["Babuchara", "Boalkhali", "Dighinala", "Kabakhali", "Merung"],
    "Guimara": ["Guimara", "Half Dohari", "Saptachari", "Sindukchari"],
    "Khagrachhari Sadar": ["Golabari", "Golabari", "Kamalchari", "Khagrachhari", "Khagrachhari Sadar", "Parachara", "Perichari"],
    "Lakshmichhari": ["Barmachari", "Dullyatali", "Laxmichhari", "Laxmichhari"],
    "Mahalchhari": ["Bhaibonchara", "Kayanghat", "Mahalchari", "Maischari", "Mobachari"],
    "Manikchhari": ["Batnatali", "Jogyachola", "Manikchari", "Manikchari", "Tintahari"],
    "Matiranga": ["Amtali", "Balchari", "Barnal", "Gomti", "Guimara", "Matiranga", "Tabalchari", "Taindong"],
    "Panchhari": ["Changi", "Latiban", "Logang", "Panchari", "Panchari"],
    "Ramgarh": ["Hafchari", "Patachara", "Ramgarh", "Ramgarh"]
  },
  "Lakshmipur": {
    "Kamalnagar": ["Char Folcon", "Char Kadira", "Char Martin", "Charkalkini", "Charlorench", "Hajirhat", "Patarirhat", "Shaheberhat", "Torabgonj"],
    "Lakshmipur Sadar": ["Bangakha", "Basikpur", "Chandrogonj", "Charramoni Mohon", "Charruhita", "Charshahi", "Dalalbazar", "Dattapara", "Digli", "Hamsadi (North)", "Hamsadi (South)", "Hazirpara", "Kusakhali", "Laharkandi", "Nourthjoypur", "Parbotinagar", "Sakchor", "Tearigonj", "Tumchor", "Vobanigonj"],
    "Raipur": ["Bamni", "Char Mohana", "Charpata", "Keora", "North Char Ababil", "North Char Bangshi", "Raipur", "Sonapur", "South Char Ababil", "South Char Bangshi"],
    "Ramganj": ["Bhadur", "Bhatra", "Bholakot", "Chandipur", "Darbeshpur", "Ichhapur", "Kanchanpur", "Karpara", "Lamchar", "Noagaon"],
    "Ramgati": ["Alxendar", "Borokheri", "Char Abdullah", "Char Algi", "Char Poragacha", "Char Ramiz", "Charbadam", "Chargazi"]
  },
  "Noakhali": {
    "Begumganj": ["Alyearpur", "Amanullapur", "Begumganj", "Chayani", "Durgapur", "Eklashpur", "Gopalpur", "Hajipur", "Jirtali", "Kadirpur", "Kutubpur", "Mirwarishpur", "Narottampur", "Rajganj", "Rasulpur", "Sharifpur"],
    "Chatkhil": ["Badalkot", "Hat-Pukuria Ghatlabag", "Khilpara", "Mohammadpur", "Noakhala", "Panchgaon", "Porokote", "Ramnarayanpur", "Sahapur"],
    "Companiganj": ["Charelahi", "Charfakira", "Charhazari", "Charkakra", "Charparboti", "Musapur", "Rampur", "Sirajpur"],
    "Hatiya": ["Burirchar", "Charishwar", "Charking", "Jahajmara", "Nijhumdwi", "Nolchira", "Sonadiya", "Sukhchar", "Tomoroddi"],
    "Kabirhat": ["Batoiya", "Chaprashirhat", "Dhanshalik", "Dhanshiri", "Ghoshbag", "Narottampur", "Sundalpur"],
    "Noakhali Sadar": ["Andarchar", "Ashwadia", "Aujbalia", "Binodpur", "Charmatua", "Dadpur", "Dharmapur", "East Charmatua", "Kadirhanif", "Kaladara", "Newajpur", "Noakhali", "Noannoi"],
    "Senbagh": ["Arjuntala", "Bejbagh", "Chhatarpaia", "Dumurua", "Kabilpur", "Kadra", "Kesharpar", "Mohammadpur", "Nabipur"],
    "Sonaimuri": ["Ambarnagor", "Amishapara", "Bajra", "Barogaon", "Chashirhat", "Deoti", "Joyag", "Nateshwar", "Nodona", "Sonapur"],
    "Subarnachar": ["Charaman Ullah", "Charbata", "Charclerk", "Charjabbar", "Charjubilee", "Charwapda", "East Charbata", "Mohammadpur"]
  },
  "Rangamati": {
    "Bagaichhari": ["Amtali", "Baghaichari", "Bongoltali", "Khedarmara", "Marisha", "Rupokari", "Sajek", "Sharoyatali"],
    "Barkal": ["Aimachara", "Barkal", "Borohorina", "Bushanchara", "Subalong"],
    "Belaichhari": ["Belaichari", "Belaichari", "Farua", "Farua", "Kengrachari"],
    "Juraichhari": ["Banajogichara", "Dumdumya", "Juraichari", "Juraichari", "Moidong"],
    "Kaptai": ["Chandraghona", "Chitmorom", "Kaptai", "Raikhali", "Wagga"],
    "Kawkhali": ["Betbunia", "Fatikchari", "Ghagra", "Kalampati", "Kawkhali"],
    "Langadu": ["Atarakchara", "Bogachattar", "Gulshakhali", "Kalapakujja", "Langad", "Maeinimukh", "Vasannadam"],
    "Naniyachar": ["Burighat", "Ghilachhari", "Naniarchar", "Naniarchar", "Sabekkhong", "Sapchari"],
    "Rajasthali": ["Balukhali", "Bangalhalia", "Gaindya", "Ghilachari", "Rajasthali"],
    "Rangamati Sadar": ["Balukhali", "Bandukbhanga", "Jibtali", "Kutukchari", "Mogban", "Sapchari"]
  },
  "Rajshahi": {
    "Bagha": ["Arani", "Bajubagha", "Bausa", "Gorgori", "Monigram", "Pakuria"],
    "Bagmara": ["Auchpara", "Basupara", "Borobihanoli", "Dippur", "Ganipur", "Gobindopara", "Gualkandi", "Hamirkutsa", "Jogipara", "Kacharikoalipara", "Mariaup", "Nordas", "Sonadanga", "Sreepur", "Suvodanga", "Zhikara"],
    "Charghat": ["Charghat", "Nimpara", "Sardah", "Solua", "Vialuxmipur", "Yousufpur"],
    "Durgapur": ["Deluabari", "Jhaluka", "Joynogor", "Kismatgankoir", "Maria", "Naopara", "Pananagar"],
    "Godagari": ["Asariadaha", "Basudebpur", "Dewpara", "Godagari", "Gogram", "Matikata", "Mohonpur", "Pakri", "Risikul"],
    "Mohanpur": ["Baksimoil", "Dhuroil", "Ghasigram", "Jahanabad", "Mougachi", "Raighati"],
    "Paba": ["Borgachi", "Damkura", "Darsanpara", "Harian", "Horipur", "Horogram", "Hujuripara", "Parila"],
    "Puthia": ["Baneswar", "Belpukuria", "Jewpara", "Puthia", "Shilmaria", "Valukgachi"],
    "Tanore": ["Badhair", "Chanduria", "Kalma", "Kamargaon", "Panchandar", "Saranjai", "Talondo"]
  },
  "Bogura": {
    "Adamdighi": ["Adamdighi", "Chapapur", "Chhatiangram", "Kundagram", "Nasaratpur", "Shantahar"],
    "Bogura Sadar": ["Erulia", "Fapore", "Gokul", "Lahiripara", "Namuja", "Nishindara", "Noongola", "Rajapur", "Sekherkola", "Shabgram", "Shakharia"],
    "Dhunat": ["Bhandarbari", "Chikashi", "Chowkibari", "Dhunat Sadar", "Elangi", "Gopalnagar", "Gossainbari", "Kalerpara", "Mothurapur", "Nimgachi"],
    "Dhupchanchia": ["Chamrul", "Dupchanchia", "Gobindapur", "Gunahar", "Talora", "Zianagar"],
    "Gabtali": ["Baliadighi", "Dakshinpara", "Durgahata", "Gabtali", "Kagail", "Mahishaban", "Naruamala", "Nasipur", "Nepaltali", "Rameshwarpur", "Sonarai"],
    "Kahaloo": ["Birkedar", "Durgapur", "Jamgaon", "Kahaloo", "Kalai", "Malancha", "Murail", "Narhatta", "Paikar"],
    "Nandigram": ["Bhatgram", "Bhatra", "Burail", "Nandigram", "Thalta Majhgram"],
    "Sariakandi": ["Bhelabari", "Bohail", "Chaluabari", "Chandanbaisha", "Hatfulbari", "Hatsherpur", "Kamalpur", "Karnibari", "Kazla", "Kutubpur", "Narchi", "Sariakandi Sadar"],
    "Shajahanpur": ["Amrul", "Aria", "Asekpur", "Chopinagar", "Gohail", "Kharna", "Khottapara", "Madla", "Majhira"],
    "Sherpur": ["Bhabanipur", "Bishalpur", "Garidaha", "Khamarkandi", "Khanpur", "Kusumbi", "Mirzapur", "Shahbondegi", "Shimabari", "Sughat"],
    "Shibganj": ["Atmul", "Bihar", "Buriganj", "Deuly", "Kichok", "Majhihatta", "Moidanhatta", "Mokamtala", "Pirob", "Raynagar", "Sayedpur", "Shibganj"],
    "Sonatola": ["Balua", "Digdair", "Madhupur", "Pakulla", "Sonatala", "Tekani Chukinagar", "Zorgacha"]
  },
  "Joypurhat": {
    "Akkelpur": ["Gopinathpur", "Raikali", "Rukindipur", "Sonamukhi", "Tilakpur"],
    "Joypurhat Sadar": ["Amdai", "Bamb", "Bhadsha", "Chakborkat", "Dhalahar", "Dogachi", "Jamalpur", "Mohammadabad", "Puranapail"],
    "Kalai": ["Ahammedabad", "Matrai", "Punot", "Udaipur", "Zindarpur"],
    "Khetlal": ["Alampur", "Borail", "Boratara", "Mamudpur", "Tulshiganga"],
    "Panchbibi": ["Aolai", "Atapur", "Aymarasulpur", "Bagjana", "Balighata", "Dharanji", "Kusumba", "Mohammadpur"]
  },
  "Naogaon": {
    "Atrai": ["Ahsanganj", "Bhonpara", "Bisha", "Hatkalupara", "Kalikapur", "Maniary", "Panchupur", "Shahagola"],
    "Badalgachhi": ["Adhaipur", "Badalgachi", "Balubhara", "Bilashbari", "Kola", "Mithapur", "Mothurapur", "Paharpur"],
    "Dhamoirhat": ["Agradigun", "Alampur", "Aranagar", "Dhamoirhat", "Isabpur", "Jahanpur", "Khelna", "Umar"],
    "Manda": ["Bisnopur", "Goneshpur", "Kalikapur", "Kashopara", "Koshob", "Kosomba", "Manda", "Moinom", "Nurullabad", "Paranpur", "Proshadpur", "Tetulia", "Valain", "Varsho"],
    "Mohadevpur": ["1nomohadevpur", "Chandas", "Cheragpur", "Enayetpur", "Hatur", "Khajur", "Roygon", "Sofapur", "Uttargram", "Vimpur"],
    "Naogaon Sadar": ["Baktiarpur", "Barshail", "Boalia", "Bolihar", "Chandipur", "Dubalhati", "Hapaniya", "Hashaigari", "Kritipur", "Shailgachhi", "Shekerpur", "Tilakpur"],
    "Niamatpur": ["Bahadurpur", "Bhabicha", "Chandannagar", "Hajinagar", "Niamatpur", "Paroil", "Rasulpur", "Sremantapur"],
    "Patnitala": ["Akbarpur", "Amair", "Dibar", "Ghasnagar", "Krishnapur", "Matindar", "Nazipur", "Nirmail", "Patichrara", "Patnitala", "Shihara"],
    "Porsha": ["Chhaor", "Ganguria", "Ghatnagar", "Moshidpur", "Nitpur", "Tetulia"],
    "Raninagar": ["Borgoca", "Ekdala", "Gona", "Kaligram", "Kashimpur", "Khatteshawr", "Mirat", "Paroil"],
    "Sapahar": ["Aihai", "Goala", "Patari", "Sapahar", "Shironti", "Tilna"]
  },
  "Natore": {
    "Bagatipara": ["Bagatipara", "Dayarampur", "Faguardiar", "Jamnagor", "Panka"],
    "Baraigram": ["Baraigram", "Chandai", "Gopalpur", "Joari", "Majgoan", "Nagor", "Zonail"],
    "Gurudaspur": ["Biaghat", "Chapila", "Dharabarisha", "Khubjipur", "Moshindha", "Nazirpur"],
    "Lalpur": ["Arbab", "Arjunpur", "Bilmaria", "Chongdhupoil", "Duaria", "Durduria", "Iswardi", "Kadimchilan", "Lalpur", "Oalia"],
    "Naldanga": ["Borda", "Khalishpur", "Madhnagar", "Naldanga", "Pitambarpur"],
    "Natore Sadar": ["Barahorispur", "Biprobelghoria", "Brahmapur", "Chhatni", "Dighapatia", "Halsa", "Kaphuria", "Khajura", "Luxmipurkholabaria", "Madhnagar", "Piprul", "Tebaria"],
    "Singra": ["Chamari", "Chaugram", "Chhatardighi", "Dahia", "Hatiandaha", "Italy", "Kalam", "Lalore", "Ramanandakhajura", "Sherkole", "Sukash", "Tajpur"]
  },
  "Chapainawabganj": {
    "Bholahat": ["Bholahat", "Daldoli", "Gohalbari", "Jambaria"],
    "Chapainawabganj Sadar": ["Alatuli", "Baliadanga", "Baroghoria", "Char Anupnagar", "Charbagdanga", "Debinagar", "Gobratola", "Islampur", "Jhilim", "Moharajpur", "Narayanpur", "Ranihati", "Shahjahanpur", "Sundarpur"],
    "Gomastapur": ["Alinagar", "Bangabari", "Boalia", "Chowdala", "Gomostapur", "Parbotipur", "Radhanagar", "Rahanpur"],
    "Nachole": ["Fhotepur", "Kosba", "Nachol", "Nezampur"],
    "Shibganj": ["Binodpur", "Chakkirti", "Chatrajitpur", "Daipukuria", "Dhainagar", "Durlovpur", "Ghorapakhia", "Kansat", "Mobarakpur", "Monakasha", "Noyalavanga", "Panka", "Shahabajpur", "Shyampur", "Ujirpur"]
  },
  "Pabna": {
    "Atgharia": ["Chandba", "Debottar", "Ekdanta", "Laxshmipur", "Majhpara"],
    "Bera": ["Chakla", "Dhalar Char", "Haturia Nakalia", "Jatsakhini", "Koitola", "Masumdia", "Notun Varenga", "Puran Varenga", "Ruppur"],
    "Bhangura": ["Ashtamanisha", "Bhangura", "Dilpasar", "Khanmarich", "Parbhangura"],
    "Chatmohar": ["Bilchalan", "Chhaikola", "Danthia Bamangram", "Failjana", "Gunaigachha", "Handial", "Haripur", "Mothurapur", "Mulgram", "Nimaichara", "Parshadanga"],
    "Faridpur": ["Banwarinagar", "Brilahiribari", "Demra", "Faridpur", "Hadal", "Pungali"],
    "Ishwardi": ["Dashuria", "Luxmikunda", "Muladuli", "Pakshi", "Sahapur", "Sara", "Silimpur"],
    "Pabna Sadar": ["Ataikula", "Bharara", "Chartarapur", "Dapunia", "Dogachi", "Gayeshpur", "Hemayetpur", "Malanchi", "Maligachha", "Sadullahpur"],
    "Santhia": ["Ar-Ataikula", "Bhulbaria", "Dhopadaha", "Dhulauri", "Gaurigram", "Karamja", "Kashinathpur", "Khetupara", "Nagdemra", "Nandanpur"],
    "Sujanagar": ["Ahammadpur", "Dulai", "Hatkhali", "Manikhat", "Nazirganj", "Raninagar", "Sagorkandi", "Satbaria", "Tantibonda", "Vaina"]
  },
  "Sirajganj": {
    "Belkuchi": ["Baradhul", "Belkuchi Sadar", "Bhangabari", "Dhukuriabera", "Doulatpur", "Rajapur"],
    "Chauhali": ["Baghutia", "Gharjan", "Khaskaulia", "Khaspukuria", "Omarpur", "Sadia Chandpur", "Sthal"],
    "Kamarkhanda": ["Bhadraghat", "Jamtail", "Jamtoil", "Jhawail", "Kamarkhand", "Roydaulatpur"],
    "Kazipur": ["Chalitadangha", "Chargirish", "Gandail", "Kazipur Sadar", "Khasrajbari", "Maijbari", "Monsur Nagar", "Natuarpara", "Nishchintapur", "Sonamukhi", "Subhagacha", "Tekani"],
    "Raiganj": ["Brommogacha", "Chandaikona", "Dhamainagar", "Dhangora", "Dhubil", "Ghurka", "Nalka", "Pangashi", "Sonakhara"],
    "Shahjadpur": ["Beltail", "Gala", "Garadah", "Habibullah Nagar", "Jalalpur", "Kayempure", "Khukni", "Koizuri", "Narina", "Porzona", "Potazia", "Rupbati", "Sonatoni"],
    "Sirajganj Sadar": ["Bagbati", "Bohuli", "Kaliahoripur", "Khokshabari", "Kowakhola", "Mesra", "Ratankandi", "Sheyalkol", "Songacha", "Soydabad"],
    "Tarash": ["Baruhas", "Deshigram", "Madhainagar", "Magura Binod", "Naogaon", "Soguna", "Talam", "Tarash Sadar"],
    "Ullahpara": ["Bangala", "Borohor", "Boropangashi", "Durga Nagar", "Hatikumrul", "Mohonpur", "Ponchocroshi", "Purnimagati", "Ramkrisnopur", "Salanga", "Salo", "Udhunia", "Ullapara Sadar"]
  },
  "Khulna": {
    "Batiaghata": ["Amirpur", "Baliadanga", "Botiaghata", "Gongarampur", "Jolma", "Surkhali", "Vandarkot"],
    "Dacope": ["Bajua", "Banishanta", "Dakop", "Kamarkhola", "Koilashgonj", "Laudoba", "Pankhali", "Sutarkhali", "Tildanga"],
    "Dighalia": ["Aronghata", "Barakpur", "Digholia", "Gajirhat", "Jogipol", "Senhati"],
    "Dumuria": ["Atlia", "Dhamalia", "Dumuria", "Ghutudia", "Khornia", "Magurghona", "Magurkhali", "Raghunathpur", "Rongpur", "Rudaghora", "Sahos", "Shorafpur", "Shovna", "Vandarpara"],
    "Koyra": ["Amadi", "Bagali", "Koyra", "Moharajpur", "Moheswaripur", "North Bedkashi", "South Bedkashi"],
    "Paikgachha": ["Chandkhali", "Deluti", "Godaipur", "Goroikhali", "Horidhali", "Kopilmuni", "Loskor", "Lota", "Raruli", "Soladana"],
    "Phultala": ["Atra Gilatola", "Damodar", "Fultola", "Jamira"],
    "Rupsha": ["Aichgati", "Ghatvog", "Noihati", "Srifoltola", "Tsb"],
    "Terokhada": ["Ajgora", "Barasat", "Chagladoho", "Modhupur", "Sochiadaho", "Terokhada"]
  },
  "Bagerhat": {
    "Bagerhat Sadar": ["Bamorta", "Baruipara", "Bishnapur", "Dema", "Gotapara", "Jatharapur", "Karapara", "Khanpur", "Rakhalgachi", "Shaitgomboj"],
    "Chitalmari": ["Barobaria", "Charbaniri", "Chitalmari", "Hizla", "Kalatala", "Shantoshpur", "Shibpur"],
    "Fakirhat": ["Bahirdia-Mansa", "Betaga", "Fakirhat", "Lakhpur", "Mulghar", "Naldha-Mouvhog", "Piljanga", "Suvhadia"],
    "Kachua": ["Badhal", "Dhopakhali", "Gojalia", "Gopalpur", "Kachua", "Moghia", "Raripara"],
    "Mollahat": ["Atjuri", "Chunkhola", "Gangni", "Gaola", "Kodalia", "Kulia", "Udoypur"],
    "Mongla": ["Burrirdangga", "Chadpai", "Chila", "Mithakhali", "Sonailtala", "Sundarban"],
    "Morrelganj": ["Baharbunia", "Balaibunia", "Banagram", "Baraikhali", "Chingrakhali", "Daibagnyahati", "Hoglabunia", "Hoglapasha", "Jiudhara", "Khaulia", "Morrelganj", "Nishanbaria", "Panchakaran", "Putikhali", "Ramchandrapur", "Teligati"],
    "Rampal": ["Baintala", "Bastoli", "Gouramva", "Hurka", "Mollikerbar", "Perikhali", "Rajnagar", "Rampal", "Uzzalkur", "Vospatia"],
    "Sarankhola": ["Dhanshagor", "Khontakata", "Rayenda", "Southkhali"]
  },
  "Chuadanga": {
    "Alamdanga": ["Ailhash", "Baradi", "Belgachi", "Bhangbaria", "Chitla", "Dauki", "Gangni", "Hardi", "Jamjami", "Jehala", "Kalidashpur", "Kashkorara", "Khadimpur", "Kumari", "Nagdah"],
    "Chuadanga Sadar": ["Alukdia", "Begumpur", "Kutubpur", "Mominpur", "Padmabila", "Shankarchandra", "Titudah"],
    "Damurhuda": ["Damurhuda", "Hawli", "Juranpur", "Karpashdanga", "Kurulgachhi", "Natipota", "Perkrishnopur Madna"],
    "Jibannagar": ["Andulbaria", "Banka", "Hasadah", "Raypur", "Shimanto", "Uthali"]
  },
  "Jashore": {
    "Abhaynagar": ["Baghutia", "Chalishia", "Payra", "Prambag", "Siddhipasha", "Sreedharpur", "Subharara", "Sundoli"],
    "Bagherpara": ["Bandabilla", "Basuari", "Darajhat", "Dhalgram", "Dohakula", "Jaharpur", "Jamdia", "Narikelbaria", "Roypur"],
    "Chaugachha": ["Chougachha", "Dhuliani", "Fulsara", "Hakimpur", "Jagadishpur", "Narayanpur", "Pashapole", "Patibila", "Singhajhuli", "Sukpukhuria", "Swarupdaha"],
    "Jashore Sadar": ["Arabpur", "Basundia", "Chanchra", "Churamankati", "Dearamodel", "Fathehpur", "Haibatpur", "Ichhali", "Kachua", "Kashimpur", "Lebutala", "Narendrapur", "Noapara", "Ramnagar", "Upasahar"],
    "Jhikargachha": ["Bankra", "Gadkhali", "Gangananda", "Hajirbagh", "Jhikargachha", "Magura", "Nabharan", "Nibaskhola", "Panisara", "Shankarpur", "Shimulia"],
    "Keshabpur": ["Bidyanandakati", "Gaurighona", "Keshabpur", "Majidpur", "Mongolkot", "Panjia", "Sagardari", "Sufalakati", "Trimohini"],
    "Manirampur": ["Bhojgati", "Chaluahati", "Dhakuria", "Durbadanga", "Haridaskati", "Hariharnagar", "Jhanpa", "Kashimnagar", "Khanpur", "Khedapara", "Kultia", "Manirampur", "Manoharpur", "Maswimnagar", "Nehalpur", "Rohita", "Shyamkur"],
    "Sharsha": ["Bagachra", "Bahadurpur", "Benapole", "Dihi", "Goga", "Kayba", "Lakshmanpur", "Nizampur", "Putkhali", "Sharsha", "Ulshi"]
  },
  "Jhenaidah": {
    "Harinakunda": ["Bhayna", "Chandpur", "Daulatpur", "Falsi", "Joradah", "Kapashatia", "Raghunathpur", "Taherhuda"],
    "Jhenaidah Sadar": ["Dogachhi", "Furshondi", "Ganna", "Ghorshal", "Halidhani", "Harishongkorpur", "Kalicharanpur", "Kumrabaria", "Maharazpur", "Modhuhati", "Naldanga", "Padmakar", "Paglakanai", "Porahati", "Sadhuhati", "Saganna", "Surat"],
    "Kaliganj": ["Barabazar", "Jamal", "Kashtabhanga", "Kola", "Maliat", "Niamatpur", "Rakhalgachhi", "Raygram", "Simla-Rokonpur", "Sundarpurdurgapur", "Trilochanpur"],
    "Kotchandpur": ["Baluhar", "Dora", "Elangi", "Kushna", "Sabdalpur"],
    "Maheshpur": ["Azampur", "Banshbaria", "Fatepur", "Jadabpur", "Kazirber", "Manderbaria", "Natima", "Nepa", "Panthapara", "Sbk", "Shyamkur", "Swaruppur"],
    "Shailkupa": ["Abaipur", "Bogura", "Dhaloharachandra", "Dignagore", "Dudshar", "Fulhari", "Hakimpur", "Kancherkol", "Manoharpur", "Mirzapur", "Nityanandapur", "Sarutia", "Tribeni", "Umedpur"]
  },
  "Kushtia": {
    "Bheramara": ["Bahadurpur", "Bahirchar", "Chandgram", "Dharampur", "Juniadah", "Mukarimpur"],
    "Daulatpur": ["Adabaria", "Aria", "Boalia", "Chilmary", "Daulatpur", "Hogolbaria", "Khalishakundi", "Moricha", "Mothurapur", "Philipnagor", "Piarpur", "Pragpur", "Ramkrishnopur", "Refaitpur"],
    "Khoksa": ["Ambaria", "Bethbaria", "Gopgram", "Janipur", "Joyntihazra", "Khoksa", "Osmanpur", "Shimulia", "Shomospur"],
    "Kumarkhali": ["Bagulat", "Chadpur", "Chapra", "Charsadipur", "Jaduboyra", "Jagonnathpur", "Kaya", "Nandolalpur", "Panti", "Sadki", "Shelaidah"],
    "Kushtia Sadar": ["Abdulpur", "Ailchara", "Alampur", "Barkhada", "Bottail", "Goswami Durgapur", "Harinarayanpur", "Hatash Haripur", "Jhaudia", "Mazampur", "Monohardia", "Patikabari", "Ujangram", "Ziaraakhi"],
    "Mirpur": ["Ambaria", "Amla", "Bahalbaria", "Baruipara", "Chhatian", "Chithalia", "Dhubail", "Fulbaria", "Kursha", "Malihad", "Poradaha", "Sadarpur", "Talbaria"]
  },
  "Magura": {
    "Magura Sadar": ["Atharokhada", "Baroilpolita", "Bogia", "Chawlia", "Gopalgram", "Hazipur", "Hazrapur", "Jagdal", "Kosundi", "Kuchiamora", "Moghi", "Raghobdair", "Satrijitpur"],
    "Mohammadpur": ["Babukhali", "Balidia", "Binodpur", "Digha", "Mohammadpur", "Nohata", "Palashbaria", "Rajapur"],
    "Shalikha": ["Arpara", "Bunagati", "Dhaneshwargati", "Gongarampur", "Shalikha", "Shatakhali", "Talkhari"],
    "Sreepur": ["Amalshar", "Dariapur", "Goyespur", "Kadirpara", "Nakol", "Shobdalpur", "Sreekol", "Sreepur"]
  },
  "Meherpur": {
    "Gangni": ["Bamondi", "Dhankolla", "Kathuli", "Kazipur", "Motmura", "Raipur", "Shaharbati", "Sholotaka", "Tentulbaria"],
    "Meherpur Sadar": ["Amdah", "Amjhupi", "Buripota", "Kutubpur", "Pirojpur"],
    "Mujibnagar": ["Bagowan", "Dariapur", "Mohajanpur", "Monakhali"]
  },
  "Narail": {
    "Kalia": ["Babrahasla", "Baioshona", "Boronaleliasabad", "Chacuri", "Hamidpur", "Jaynagor", "Kalabaria", "Khashial", "Mauli", "Pahordanga", "Panchgram", "Peroli", "Purulia", "Salamabad"],
    "Lohagara": ["Digholia", "Itna", "Joypur", "Kashipur", "Kotakol", "Lahuria", "Lakshmipasha", "Lohagora", "Mallikpur", "Naldi", "Noagram", "Salnagar"],
    "Narail Sadar": ["Auria", "Bashgram", "Bhadrabila", "Bisali", "Chandiborpur", "Habokhali", "Kalora", "Maijpara", "Mulia", "Shahabad", "Sheikhati", "Singasholpur", "Tularampur"]
  },
  "Satkhira": {
    "Assasuni": ["Anulia", "Assasuni", "Baradal", "Budhhata", "Durgapur", "Kadakati", "Khajra", "Kulla", "Pratapnagar", "Sobhnali", "Sreeula"],
    "Debhata": ["Debhata", "Kulia", "Noapara", "Parulia", "Sakhipur"],
    "Kalaroa": ["Chandanpur", "Deara", "Helatala", "Jallabad", "Jogikhali", "Joynagar", "Kaila", "Keragachhi", "Keralkata", "Kushadanga", "Langaljhara", "Sonabaria"],
    "Kaliganj": ["Bharasimla", "Bishnupur", "Champaphul", "Dakshin Sreepur", "Dhalbaria", "Krishnanagar", "Kushlia", "Mathureshpur", "Mautala", "Nalta", "Ratanpur", "Tarali"],
    "Satkhira Sadar": ["Agardari", "Alipur", "Baikari", "Balli", "Banshdaha", "Bhomra", "Brahmarajpur", "Dhulihar", "Fingri", "Ghona", "Jhaudanga", "Kuskhali", "Labsa", "Shibpur"],
    "Shyamnagar": ["Atulia", "Bhurulia", "Burigoalini", "Gabura", "Ishwaripur", "Kaikhali", "Kashimari", "Munshiganj", "Nurnagar", "Padmapukur", "Ramjannagar", "Shyamnagar"],
    "Tala": ["Dhandia", "Islamkati", "Jalalpur", "Khalilnagar", "Khalishkhali", "Khesra", "Kumira", "Magura", "Nagarghata", "Sarulia", "Tala", "Tentulia"]
  },
  "Barishal": {
    "Agailjhara": ["Bagdha", "Bakal", "Goila", "Rajihar", "Ratnapur"],
    "Babuganj": ["Chandpasha", "Deherhoti", "Jahangir Nagar", "Kaderpur", "Madhbpasha", "Rahamtpur"],
    "Bakerganj": ["Bharpasha", "Charade", "Charamaddi", "Darial", "Dudhal", "Durgapasha", "Faridpur", "Garuria", "Kabai", "Kalashkathi", "Nalua", "Niamoti", "Padreeshibpur", "Rangasree"],
    "Banaripara": ["Baishari", "Banaripara", "Bisharkandi", "Chakhar", "Illuhar", "Saliabakpur", "Sayedkathi", "Udykhati"],
    "Barishal Sadar": ["Chandpura", "Chandramohan", "Charbaria", "Charcowa", "Charmonai", "Kashipur", "Raipasha Karapur", "Shyastabad", "Tungibaria", "Zagua"],
    "Gaurnadi": ["Barthi", "Batajore", "Chandshi", "Khanjapur", "Mahilara", "Nalchira", "Sarikal"],
    "Hizla": ["Barjalia", "Dhulkhola", "Guabaria", "Harinathpur", "Hizla Gourabdi", "Memania"],
    "Mehendiganj": ["Alimabad", "Andarmanik", "Bhashanchar", "Biddanandapur", "Chandpur", "Charakkorea", "Chargopalpur", "Darirchar Khajuria", "Gobindapur", "Jangalia", "Lata", "Mehendigong", "Ulania"],
    "Muladi": ["Batamara", "Charkalekha", "Gaschua", "Kazirchar", "Muladi", "Nazirpur", "Safipur"],
    "Uzirpur": ["Bamrail", "Barakhota", "Gouthia", "Harta", "Jalla", "Otra", "Shatla", "Shikerpur Wazirpur", "Sholok"]
  },
  "Barguna": {
    "Amtali": ["Amtali", "Arpangasia", "Athrogasia", "Chotobogi", "Chowra", "Gulishakhali", "Haldia", "Kukua"],
    "Bamna": ["Bamna", "Bukabunia", "Doutola", "Ramna"],
    "Barguna Sadar": ["Ayla Patakata", "Barguna", "Bodorkhali", "Burirchor", "Dhalua", "Fuljhuri", "Gowrichanna", "Keorabunia", "M. Baliatali", "Noltona"],
    "Betagi": ["Betagi", "Bibichini", "Buramajumder", "Hosnabad", "Kazirabad", "Mokamia", "Sarisamuri"],
    "Patharghata": ["Charduany", "Kakchira", "Kalmegha", "Kathaltali", "Nachnapara", "Patharghata", "Raihanpur"],
    "Taltali": ["Barabagi", "Chhotabagi", "Karibaria", "Nishanbaria", "Panchakoralia", "Sarikkhali", "Sonakata"]
  },
  "Bhola": {
    "Bhola Sadar": ["Alinagor", "Bapta", "Charshamya", "Dhania", "Ilisha", "Kachia", "North Digholdi", "Razapur", "Shibpur", "South Digholdi", "Vheduria", "Vhelumia", "Westilisa"],
    "Burhanuddin": ["Boromanika", "Deula", "Kachia", "Kutuba", "Pakshia"],
    "Char Fasson": ["Abdullahpur", "Abubakarpur", "Aminabad", "Aslampur", "Awajpur", "Awajpur", "Charkolmi", "Charmadraj", "Charmanika", "Dalchar", "Hazarigonj", "Jahanpur", "Kukrimukri", "Mujibnagar", "Nazrulnagar", "Nilkomol", "Nurabad", "Osmangonj", "Rasulpur", "Zinnagor"],
    "Daulatkhan": ["Char Khalipa", "Charpata", "Hazipur", "Madanpur", "Madua", "North Joy Nagar", "Sayedpur", "South Joy Nagar", "Vhovanipur"],
    "Lalmohan": ["Badarpur", "Charbhuta", "Dholigour Nagar", "Farajgonj", "Kalma", "Lalmohan", "Lord Hardinge", "Paschim Char Umed", "Ramagonj"],
    "Manpura": ["Hazirhat", "Monpura", "North Sakuchia", "South Sakuchia"],
    "Tazumuddin": ["Baro Molongchora", "Chadpur", "Chanchra", "Shambupur", "Sonapur"]
  },
  "Jhalokati": {
    "Jhalokati Sadar": ["Basanda", "Binoykati", "Gabharamchandrapur", "Gabkhandhansiri", "Keora", "Kirtipasha", "Nabagram", "Nathullabad", "Ponabalia", "Sekherhat"],
    "Kathalia": ["Amua", "Awrabunia", "Chenchrirampur", "Kanthalia", "Patikhalghata", "Shaulajalia"],
    "Nalchity": ["Bharabpasha", "Dapdapia", "Kulkathi", "Kusanghal", "Magar", "Mollahat", "Nachanmohal", "Ranapasha", "Siddhakati", "Subidpur"],
    "Rajapur": ["Baraia", "Galua", "Mathbari", "Rajapur", "Saturia", "Suktagarh"]
  },
  "Patuakhali": {
    "Bauphal": ["Adabaria", "Bauphal", "Boga", "Daspara", "Dhulia", "Kachipara", "Kalaiya", "Kalisuri", "Kanakdia", "Keshabpur", "Madanpura", "Najirpur", "Nawmala", "Shurjamoni"],
    "Dashmina": ["Alipur", "Baharampur", "Bashbaria", "Betagi Shankipur", "Dashmina", "Rangopaldi"],
    "Dumki": ["Angaria", "Labukhali", "Muradia", "Pangasia", "Sreerampur"],
    "Galachipa": ["Amkhola", "Bakulbaria", "Charbiswas", "Charkajol", "Chiknikandi", "Dakua", "Galachipa", "Gazalia", "Golkhali", "Kalagachhia", "Panpatty", "Ratandi Taltali"],
    "Kalapara": ["Baliatali", "Chakamaia", "Champapur", "Dalbugonj", "Dhankhali", "Dulaser", "Lalua", "Latachapli", "Mahipur", "Mithagonj", "Nilgonj", "Tiakhali"],
    "Mirzaganj": ["Amragachia", "Deuli Subidkhali", "Kakrabunia", "Madhabkhali", "Majidbaria", "Mirzaganj"],
    "Patuakhali Sadar": ["Auliapur", "Badarpur", "Borobighai", "Chotobighai", "Itbaria", "Jainkathi", "Kalikapur", "Kamalapur", "Laukathi", "Lohalia", "Madarbunia", "Marichbunia"],
    "Rangabali": ["Barobaisdia", "Chalitabunia", "Charmontaz", "Chattobaisdia", "Rangabali"]
  },
  "Pirojpur": {
    "Bhandaria": ["Dhaoa", "Ekree", "Gouripur", "Nodmulla", "Telikhali", "Vandaria Sadar", "Vitabaria"],
    "Indurkani": ["Balipara", "Parerhat", "Pattashi", "Saorakathi", "Zianagar"],
    "Kawkhali": ["Amrazuri", "Chirapara", "Kawkhali Sadar", "Sayna Rogunathpur", "Shialkhathi"],
    "Mathbaria": ["Amragachia", "Baramasua", "Betmor Rajpara", "Daudkhali", "Dhanisafa", "Haltagulishakhali", "Mathbaria", "Mirukhali", "Shapleza", "Tikikata", "Tuskhali"],
    "Nazirpur": ["Daulbari Dobra", "Dirgha", "Kolardoania", "Malikhali", "Mativangga", "Nazirpur Sadar", "Shakharikathi", "Shakhmatia", "Sriramkathi"],
    "Nesarabad": ["Atghorkuriana", "Boldia", "Doyhary", "Guarekha", "Jolabari", "Sarengkathi", "Shorupkathi", "Sohagdal", "Somudoykathi", "Sutiakathi"],
    "Pirojpur Sadar": ["Durgapur", "Kodomtala", "Kolakhali", "Shankorpasa", "Shariktola", "Shikder Mallik", "Tona"]
  },
  "Sylhet": {
    "Balaganj": ["Balaganj", "Boaljur", "Dewanbazar", "East Gouripur", "East Poilanpur", "West Gouripur"],
    "Beanibazar": ["Alinagar", "Charkhai", "Dubag", "Kurarbazar", "Lauta", "Mathiura", "Mullapur", "Muria", "Sheola", "Tilpara"],
    "Bishwanath": ["Alankari", "Bishwanath", "Daulatpur", "Dewkalash", "Doshghar", "Khajanchi", "Lamakazi", "Rampasha"],
    "Companiganj": ["Dakkin Ronikhai", "Isakalas", "Islampur Paschim", "Islampur Purba", "Telikhal", "Uttor Ronikhai"],
    "Dakshin Surma": ["Boroikandi", "Daudpur", "Jalalpur", "Kamalbazar", "Kuchai", "Lalabazar", "Moglabazar", "Mollargaon", "Silam", "Tetli"],
    "Fenchuganj": ["Fenchuganj", "Ghilachora", "Maijgaon", "Uttar Fenchuganj", "Uttar Kushiara"],
    "Golapganj": ["Bhadeshwar", "Budhbaribazar", "Dhakadakshin", "Fulbari", "Golapganj", "Lakshanaband", "Lakshmipasha", "Sharifganj", "Uttar Badepasha", "West Amura"],
    "Gowainghat": ["Alirgaon", "Daubari", "Fothepur", "Lengura", "Nandirgaon", "Paschim Jaflong", "Purba Jaflong", "Rustampur", "Towakul"],
    "Jaintiapur": ["Charikatha", "Chiknagul", "Darbast", "Fatehpur", "Jaintapur", "Nijpat"],
    "Kanaighat": ["Barachotul", "Dakhin Banigram", "Digirpar Purbo", "Jinghabari", "Kanaighat", "Lakshiprashad Pashim", "Lakshiprashad Purbo", "Rajagonj", "Satbakh"],
    "Osmani Nagar": ["Burungabazar", "Doyamir", "Goalabazar", "Sadipur", "Tazpur", "Umorpur", "Usmanpur", "West Poilanpur"],
    "Sylhet Sadar": ["Hatkhula", "Jalalabad", "Kandigaon", "Khadimnagar", "Khadimpara", "Mugolgaon", "Tukerbazar", "Tultikor"],
    "Zakiganj": ["Barohal", "Barothakuri", "Birorsri", "Kajalshah", "Kaskanakpur", "Kolachora", "Manikpur", "Sultanpur", "Zakiganj"]
  },
  "Habiganj": {
    "Ajmiriganj": ["Ajmiriganj Sadar", "Badolpur", "Jolsuka", "Kakailsao", "Shibpasha"],
    "Bahubal": ["Bahubal Sadar", "Bhadeshwar", "Lamatashi", "Mirpur", "Putijuri", "Satkapon", "Snanghat"],
    "Baniyachong": ["Baniachong North East", "Baniachong North West", "Baniachong South East", "Baniachong South West", "Baraiuri", "Daulatpur", "Kagapasha", "Khagaura", "Makrampur", "Mandari", "Muradpur", "Pailarkandi", "Pukra", "Subidpur", "Sujatpur"],
    "Chunarughat": ["Ahammadabad", "Chunarughat", "Deorgach", "Gazipur", "Mirashi", "Paikpara", "Ranigaon", "Shankhala", "Shatiajuri", "Ubahata"],
    "Habiganj Sadar": ["Gopaya", "Laskerpur", "Lukra", "Nijampur", "Nurpur", "Poil", "Rajiura", "Richi", "Shayestaganj", "Teghoria"],
    "Lakhai": ["Bamoi", "Bulla", "Karab", "Lakhai", "Murakari", "Muriauk"],
    "Madhabpur": ["Adaoir", "Andiura", "Bagashura", "Bahara", "Bulla", "Chhatiain", "Choumohani", "Dharmaghar", "Jagadishpur", "Noapara", "Shahjahanpur"],
    "Nabiganj": ["Aushkandi", "Barabhakoir Paschim", "Barabhakoir Purba", "Bausha", "Debparra", "Digholbak", "Gaznaipur", "Inatganj", "Kaliarbhanga", "Kargoan", "Kurshi", "Nabiganj Sadar", "Paniumda"]
  },
  "Moulvibazar": {
    "Barlekha": ["Baralekha", "Borni", "Dakkhin Shahbajpur", "Dakshinbhag Dakkhin", "Dakshinbhag Uttar", "Dasherbazar", "Nizbahadurpur", "Sujanagar", "Talimpur", "Talimpur", "Uttar Shahbajpur"],
    "Juri": ["Eastjuri", "Fultola", "Gualbari", "Jafornagar", "Sagornal", "West Juri"],
    "Kamalganj": ["Adampur", "Alinagar", "Islampur", "Kamalgonj", "Madhabpur", "Munshibazar", "Patanushar", "Rahimpur", "Shamshernagar"],
    "Kulaura": ["Baramchal", "Bhatera", "Bhukshimail", "Brammanbazar", "Hazipur", "Joychandi", "Kadipur", "Kormodha", "Kulaura", "Prithimpassa", "Rauthgaon", "Sharifpur", "Tilagaon"],
    "Moulvibazar Sadar": ["Akhailkura", "Amtail", "Apar Kagabala", "Chadnighat", "Ekatuna", "Giasnagar", "Kamalpur", "Khalilpur", "Konokpur", "Monumukh", "Mostafapur", "Nazirabad"],
    "Rajnagar": ["Fotepur", "Kamarchak", "Munsibazar", "Munsurnagar", "Panchgaon", "Rajnagar", "Tengra", "Uttorbhag"],
    "Sreemangal": ["Ashidron", "Bhunabir", "Kalapur", "Kalighat", "Mirzapur", "Rajghat", "Satgaon", "Sindurkhan", "Sreemangal"]
  },
  "Sunamganj": {
    "Bishwamvarpur": ["Badaghat South", "Dhanpur", "Fatepur", "Palash", "Solukabad"],
    "Chhatak": ["Bhatgaon", "Chhaila Afjalabad", "Chhatak Sadar", "Chormohalla", "Dolarbazar", "Gobindganj-Syedergaon", "Islampur", "Jauwabazar", "Kalaruka", "Khurma North", "Khurma South", "Noarai", "Singchapair"],
    "Derai": ["Bhatipara", "Charnarchar", "Derai Sarmangal", "Jagddol", "Karimpur", "Kulanj", "Rafinagar", "Rajanagar", "Taral"],
    "Dharamapasha": ["Bongshikunda North", "Bongshikunda South", "Chamordani", "Dharmapasha Sadar", "Joyasree", "Madhyanagar", "Paikurati", "Selbarash", "Sukhair Rajapur North", "Sukhair Rajapur South"],
    "Dowarabazar": ["Banglabazar", "Boglabazar", "Dohalia", "Dowarabazar", "Laxmipur", "Mannargaon", "Norsingpur", "Pandargaon", "Surma"],
    "Jagannathpur": ["Asharkandi", "Chilaura Holdipur", "Kolkolia", "Mirpur", "Pailgaon", "Patli", "Raniganj", "Syedpur Shaharpara"],
    "Jamalganj": ["Beheli", "Bhimkhali", "Fenerbak", "Jamalganj Sadar", "Sachnabazar"],
    "Madhyanagar": ["Bagher Bazar", "Chandpur", "Halir Haor", "Madhyanagar", "Patharia"],
    "Shantiganj": ["Dargapasha", "Joykalash", "Paschim Birgaon", "Paschim Pagla", "Patharia", "Purba Birgaon", "Purba Pagla", "Shimulbak"],
    "Sullah": ["Atgaon", "Bahara", "Habibpur", "Shalla Sadar"],
    "Sunamganj Sadar": ["Aptabnagar", "Gourarang", "Jahangirnagar", "Kathair", "Laxmansree", "Mohonpur", "Mollapara", "Rangarchar", "Surma"],
    "Tahirpur": ["Badaghat", "Balijuri", "Bordal North", "Bordal South", "Sreepur North", "Sreepur South", "Tahirpur Sadar"]
  },
  "Rangpur": {
    "Badarganj": ["Bishnapur", "Damodorpur", "Gopalpur", "Gopinathpur", "Kalupara", "Kutubpur", "Lohanipara", "Modhupur", "Radhanagar", "Ramnathpurupb"],
    "Gangachhara": ["Alambiditor", "Betgari", "Borobil", "Gojoghonta", "Gongachora", "Kholeya", "Kolcondo", "Lakkhitari", "Morneya", "Nohali"],
    "Kaunia": ["Balapara", "Haragach", "Kurshaupk", "Sarai", "Shahidbag", "Tepamodhupur"],
    "Mithapukur": ["Balarhat", "Baluya Masimpur", "Boro Hazratpur", "Borobala", "Chengmari", "Durgapur", "Imadpur", "Kafrikhal", "Khoragach", "Latibpur", "Mgopalpur", "Milonpur", "Mirzapur", "Moyenpur", "Payrabond", "Ranipukur", "Vangni"],
    "Pirgachha": ["Annodanagar", "Itakumari", "Kandi", "Koikuri", "Kollyani", "Parul", "Pirgacha", "Saula", "Tambulpur"],
    "Pirganj": ["Boro Alampur", "Borodargah", "Chattra", "Chattracol", "Kabilpur", "Kumedpur", "Mithipur", "Modankhali", "Pachgachi", "Pirgonj", "Ramnathpur", "Raypur", "Shanerhat", "Tukuria", "Vendabari"],
    "Rangpur Sadar": ["Chandanpat", "Dorshona", "Horidebpur", "Mominpur", "Porshuram", "Rajendrapur", "Sadwapuskoroni", "Satgara", "Tampat", "Topodhan", "Uttam"],
    "Taraganj": ["Alampur", "Hariarkuthi", "Ikorchali", "Kurshatara", "Soyar"]
  },
  "Dinajpur": {
    "Biral": ["Azimpur", "Bhandra", "Bijora", "Birol", "Dhamoir", "Dharmapur", "Farakkabad", "Mongalpur", "Rajarampur", "Ranipukur", "Shohorgram"],
    "Birampur": ["Binail", "Dior", "Jatbani", "Katla", "Khanpur", "Mukundopur", "Poliproyagpur"],
    "Birganj": ["Bhognagar", "Mohammadpur", "Mohonpur", "Moricha", "Nijpara", "Paltapur", "Polashbari", "Sator", "Shatagram", "Shibrampur", "Sujalpur"],
    "Bochaganj": ["Atgaon", "Eshania", "Murshidhat", "Nafanagar", "Rongaon", "Shatail"],
    "Chirirbandar": ["Abdulpur", "Alokdihi", "Amarpur", "Auliapukur", "Fatejangpur", "Isobpur", "Nashratpur", "Punotti", "Saitara", "Satnala", "Tetulia", "Viail"],
    "Dinajpur Sadar": ["Askorpur", "Auliapur", "Chealgazi", "Fazilpur", "Kamalpur", "Sankarpur", "Shashora", "Shekpura", "Sundorbon", "Uthrail"],
    "Ghoraghat": ["Bulakipur", "Ghoraghat", "Palsha", "Singra"],
    "Hakimpur": ["Alihat", "Boalder", "Hakimpur", "Khattab", "Khattamadobpara"],
    "Kaharole": ["Dabor", "Mukundapur", "Ramchandrapur", "Rasulpur", "Sundarpur", "Targao"],
    "Khansama": ["Alokjhari", "Angarpara", "Bhabki", "Bherbheri", "Goaldihi", "Khamarpara"],
    "Nawabganj": ["Bhaduria", "Binodnagar", "Daudpur", "Golapgonj", "Joypur", "Kushdaha", "Mahmudpur", "Putimara", "Shalkhuria"],
    "Parbatipur": ["Belaichandi", "Chandipur", "Habra", "Hamidpur", "Harirampur", "Mominpur", "Monmothopur", "Mostofapur", "Polashbari", "Rampur"],
    "Phulbari": ["Aladipur", "Aloary", "Bethdighi", "Daulatpur", "Kagihal", "Khairbari", "Shibnagor"]
  },
  "Gaibandha": {
    "Gaibandha Sadar": ["Badiakhali", "Ballamjhar", "Boali", "Ghagoa", "Gidari", "Kamarjani", "Kholahati", "Kuptola", "Laxmipur", "Malibari", "Mollarchar", "Ramchandrapur", "Shahapara"],
    "Gobindaganj": ["Dorbosto", "Gumaniganj", "Harirampur", "Kamardoho", "Kamdia", "Katabari", "Kochasahar", "Mahimaganj", "Nakai", "Phulbari", "Rajahar", "Rakhalburuj", "Sapmara", "Shakhahar", "Shalmara", "Shibpur", "Talukkanupur"],
    "Palashbari": ["Barisal", "Betkapa", "Harinathpur", "Hosenpur", "Kishoregari", "Mohdipur", "Monohorpur", "Palashbari", "Pobnapur"],
    "Phulchhari": ["Erendabari", "Fazlupur", "Gazaria", "Kanchipara", "Phulchari", "Udakhali", "Uria"],
    "Sadullapur": ["Bongram", "Damodorpur", "Dhaperhat", "Faridpur", "Idilpur", "Jamalpur", "Kamarpara", "Khodkomor", "Noldanga", "Rasulpur", "Vatgram"],
    "Sughatta": ["Bonarpara", "Ghuridah", "Holdia", "Jumarbari", "Kachua", "Kamalerpara", "Muktinagar", "Padumsahar", "Saghata", "Varotkhali"],
    "Sundarganj": ["Bamondanga", "Belka", "Chandipur", "Chaporhati", "Dhopadanga", "Dohbond", "Haripur", "Kapasia", "Konchibari", "Ramjibon", "Shantiram", "Sonaroy", "Sorbanondo", "Sreepur", "Tarapur"]
  },
  "Kurigram": {
    "Bhurungamari": ["Andharirjhar", "Bangasonahat", "Bhurungamari", "Boldia", "Char-Bhurungamari", "Joymonirhat", "Paikarchara", "Pathordubi", "Shilkhuri", "Tilai"],
    "Char Rajibpur": ["Charrajibpur", "Kodalkati", "Moghalbasa", "Mohongonj", "Rajibpur"],
    "Chilmari": ["Austomirchar", "Chilmari", "Nayarhat", "Ramna", "Ranigonj", "Thanahat"],
    "Kurigram Sadar": ["Belgacha", "Bhogdanga", "Ghogadhoh", "Holokhana", "Jatrapur", "Kanthalbari", "Mogolbasa", "Panchgachi"],
    "Nageshwari": ["Bamondanga", "Berubari", "Bhitorbond", "Bollobherkhas", "Hasnabad", "Kachakata", "Kaligonj", "Kedar", "Narayanpur", "Newyashi", "Noonkhawa", "Raigonj", "Ramkhana", "Sontaspur"],
    "Phulbari": ["Baravita", "Bhangamor", "Kashipur", "Nawdanga", "Phulbari", "Shimulbari"],
    "Rajarhat": ["Biddanondo", "Chakirpashar", "Chinai", "Gharialdanga", "Nazimkhan", "Rajarhat", "Umarmajid"],
    "Raomari": ["Bondober", "Dadevanga", "Jadurchar", "Rowmari", "Shoulemari"],
    "Ulipur": ["Bazra", "Begumgonj", "Buraburi", "Daldalia", "Dhamsreni", "Dharanibari", "Durgapur", "Gunaigas", "Hatia", "Pandul", "Shahabiar Alga", "Thetrai", "Tobockpur"]
  },
  "Lalmonirhat": {
    "Aditmari": ["Bhadai", "Bhelabari", "Durgapur", "Kamlabari", "Mohishkhocha", "Palashi", "Saptibari", "Sarpukur"],
    "Hatibandha": ["Barokhata", "Dawabari", "Fakirpara", "Goddimari", "Gotamari", "Nowdabas", "Paticapara", "Shaniajan", "Sindurna", "Singimari", "Tongvhanga", "Vhelaguri"],
    "Kaliganj": ["Bhotmari", "Cholbola", "Chondropur", "Dologram", "Goral", "Kakina", "Modati", "Tushbhandar"],
    "Lalmonirhat Sadar": ["Barobari", "Gokunda", "Harati", "Khuniagachh", "Kulaghat", "Mogolhat", "Mohendranagar", "Panchagram", "Rajpur"],
    "Patgram": ["Baura", "Burimari", "Dahagram", "Jagatber", "Jongra", "Kuchlibari", "Patgram", "Sreerampur"]
  },
  "Nilphamari": {
    "Dimla": ["Balapara", "Dimla Sadar", "Gayabari", "Jhunagach Chapani", "Khalisha Chapani", "Khogakharibari", "Noutara", "Paschim Chhatnay", "Purba Chhatnay", "Tepa Khribari"],
    "Domar": ["Bamunia", "Bhogdaburi", "Boragari", "Domar", "Gomnati", "Harinchara", "Jorabari", "Ketkibari", "Panga Motukpur", "Sonaray"],
    "Jaldhaka": ["Balagram", "Dharmapal", "Douabari", "Golmunda", "Golna", "Kaimari", "Kathali", "Khutamara", "Mirganj", "Shaulmari", "Simulbari"],
    "Kishoreganj": ["Bahagili", "Barabhita", "Chandkhana", "Garagram", "Kishoreganj", "Magura", "Nitai", "Putimari", "Ranachandi"],
    "Nilphamari Sadar": ["Chaora Bargacha", "Chapra Sarnjami", "Charaikhola", "Gorgram", "Itakhola", "Kachukata", "Khoksabari", "Kundapukur", "Lakshmicha", "Palasbari", "Panchapukur", "Ramnagar", "Sonaray", "Songalsi", "Tupamari"],
    "Saidpur": ["Bangalipur", "Botlagari", "Kamarpukur", "Kasiram Belpukur", "Khata Madhupur"]
  },
  "Panchagarh": {
    "Atwari": ["Alowakhowa", "Balarampur", "Dhamor", "Mirgapur", "Radhanagar", "Toria"],
    "Boda": ["Banghari", "Boda", "Boroshoshi", "Chandanbari", "Jholaishal Shiri", "Kajoldighi Kaligonj", "Marea Bamonhat", "Moidandighi", "Pachpir", "Sakoa"],
    "Debiganj": ["Chengthi Hazra Danga", "Chilahati", "Dandopal", "Debiduba", "Debiganj Sadar", "Pamuli", "Shaldanga", "Sonahar Mollikadaha", "Sundardighi", "Tepriganj"],
    "Panchagarh Sadar": ["Amarkhana", "Chaklahat", "Dhakkamara", "Garinabari", "Hafizabad", "Haribhasa", "Kamat Kajol Dighi", "Magura", "Panchagarh Sadar", "Satmara"],
    "Tetulia": ["Banglabandha", "Bhojoanpur", "Bhojoanpur", "Buraburi", "Debnagar", "Salbahan", "Tentulia", "Timaihat"]
  },
  "Thakurgaon": {
    "Baliadangi": ["Amjankhore", "Borobari", "Boropalashbari", "Charol", "Dhontola", "Duosuo", "Paria", "Vanor"],
    "Haripur": ["Amgaon", "Bakua", "Bhaturia", "Dangipara", "Gedura", "Haripur"],
    "Pirganj": ["Bairchuna", "Bhomradaha", "Daulatpur", "Hajipur", "Jabarhat", "Khangaon", "Kosharaniganj", "Pirganj", "Saidpur", "Sengaon"],
    "Ranisankail": ["Bachor", "Dhormogarh", "Hosengaon", "Kashipur", "Lehemba", "Nekmorod", "Nonduar", "Ratore"],
    "Thakurgaon Sadar": ["Ahcha", "Akhanagar", "Auliapur", "Balia", "Baragaon", "Begunbari", "Chilarang", "Debipur", "Dholarhat", "Gareya", "Jagannathpur", "Jamalpur", "Mohammadpur", "Nargun", "Rahimanpur", "Rajagaon", "Roypur", "Ruhea", "Ruhia Pashchim", "Salandar", "Sukhanpukhari"]
  },
  "Mymensingh": {
    "Bhaluka": ["Bhaluka", "Birunia", "Dakatia", "Dhitpur", "Habirbari", "Kachina", "Mallikbari", "Meduari", "Rajoi", "Uthura", "Varadoba"],
    "Dhobaura": ["Baghber", "Dakshin Maijpara", "Dhobaura", "Gamaritola", "Ghoshgaon", "Goatala", "Porakandulia"],
    "Fulbaria": ["Asimpatuli", "Bakta", "Balian", "Deukhola", "Enayetpur", "Fulbaria", "Kaladaha", "Kushmail", "Naogaon", "Putijana", "Radhakanai", "Rangamatia", "Vobanipur"],
    "Gafargaon": ["Barobaria", "Charalgi", "Dotterbazar", "Gafargaon", "Josora", "Longair", "Moshakhali", "Niguari", "Paithol", "Panchbagh", "Raona", "Rasulpur", "Saltia", "Tangabo", "Usthi"],
    "Gauripur": ["Achintapur", "Bhangnamari", "Bokainagar", "Douhakhola", "Gouripur", "Mailakanda", "Maoha", "Ramgopalpur", "Sahanati", "Sidhla"],
    "Haluaghat": ["Amtoil", "Bhubankura", "Bildora", "Dhara", "Dhurail", "Gazirbhita", "Haluaghat", "Jugli", "Kaichapur", "Narail", "Sakuai", "Swadeshi"],
    "Ishwarganj": ["Atharabari", "Barahit", "Iswarganj", "Jatia", "Magtula", "Maijbagh", "Rajibpur", "Sarisha", "Sohagi", "Tarundia", "Uchakhila"],
    "Muktagachha": ["Basati", "Borogram", "Daogaon", "Dulla", "Ghoga", "Kashimpur", "Kheruajani", "Kumargata", "Mankon", "Tarati"],
    "Mymensingh Sadar": ["Aqua", "Austadhar", "Bororchar", "Boyra", "Char Ishwardia", "Charnilaxmia", "Dapunia", "Ghagra", "Khagdohor", "Kushtia", "Paranganj", "Sirta", "Vabokhali"],
    "Nandail": ["Achargaon", "Batagoir", "Chandipasha", "Gangail", "Jahangirpur", "Kharua", "Muajjempur", "Mushulli", "Nandail", "Rajgati", "Sherpur", "Singroil"],
    "Phulpur": ["Balia", "Baola", "Payari", "Phulpur", "Rahimganj", "Rambhadrapur", "Rupasi", "Singheshwar", "Sondhara", "Vaitkandi"],
    "Tarakanda": ["Balikha", "Banihala", "Biska", "Dhakua", "Galagaon", "Kakni", "Kamargaon", "Kamaria", "Rampur", "Tarakanda"],
    "Trishal": ["Amirabari", "Bailor", "Balipara", "Dhanikhola", "Harirampur", "Kanihari", "Kanthal", "Mathbari", "Mokshapur", "Rampur", "Sakhua", "Trishal"]
  },
  "Jamalpur": {
    "Baksiganj": ["Bagarchar", "Bakshigonj", "Battajore", "Danua", "Merurchar", "Nilakhia", "Shadurpara"],
    "Dewanganj": ["Bahadurabad", "Char Amkhawa", "Chikajani", "Chukaibari", "Dewangonj", "Dungdhara", "Hatibanga", "Parram Rampur"],
    "Islampur": ["Belghacha", "Chargualini", "Charputimari", "Chinaduli", "Gaibandha", "Gualerchar", "Islampur", "Kulkandi", "Noarpara", "Palabandha", "Partharshi", "Shapdari"],
    "Jamalpur Sadar": ["Bashchara", "Digpait", "Ghorada", "Itail", "Kendua", "Laxirchar", "Mesta", "Narundi", "Ranagacha", "Rashidpur", "Shahbajpur", "Sharifpur", "Sheepur", "Titpalla", "Tolshirchar"],
    "Madarganj": ["Adarvita", "Balijuri", "Char Pakerdah", "Gunaritala", "Jorekhali", "Karaichara", "Sidhuli"],
    "Melandaha": ["Adra", "Charbani Pakuria", "Durmot", "Fulkucha", "Ghuserpara", "Jhaugara", "Kulia", "Mahmudpur", "Nangla", "Nayanagar", "Shuampur"],
    "Sarishabari": ["Aona", "Bhatara", "Doail", "Kamrabad", "Mahadan", "Pingna", "Pogaldigha", "Satpoa"]
  },
  "Netrokona": {
    "Atpara": ["Baniyajan", "Duoj", "Lunesshor", "Shormushia", "Shunoi", "Sukhari", "Teligati"],
    "Barhatta": ["Asma", "Barhatta", "Baushi", "Chhiram", "Raypur", "Sahata", "Singdha"],
    "Durgapur": ["Bakaljora", "Birisiri", "Chandigarh", "Durgapur", "Gawkandia", "Kakoirgora", "Kullagora"],
    "Kalmakanda": ["Borokhapon", "Kharnoi", "Koilati", "Kolmakanda", "Lengura", "Najirpur", "Pogla", "Rongchati"],
    "Khaliajuri": ["Chakua", "Gazipur", "Khaliajuri", "Krishnapur", "Mendipur", "Nogor"],
    "Kendua": ["Asujia", "Bolaishimul", "Chirang", "Dalpa", "Gonda", "Goraduba", "Kandiura", "Maska", "Muzafarpur", "Noapara", "Paikura", "Roailbari Amtala", "Sandikona"],
    "Madan": ["Chandgaw", "Fathepur", "Gobindasree", "Kytail", "Madan", "Magan", "Nayekpur", "Teosree"],
    "Mohanganj": ["Borokashia Birampur", "Borotoli Banihari", "Gaglajur", "Maghan Siadar", "Somaj Sohildeo", "Suair", "Tetulia"],
    "Netrokona Sadar": ["Amtola", "Chollisha", "Dokkhin Bishiura", "Kailati", "Kaliara Babragati", "Lokkhiganj", "Medni", "Modonpur", "Mougati", "Rouha", "Singher Bangla", "Thakurakona"],
    "Purbadhala": ["Agia", "Bairaty", "Bishkakuni", "Dhalamulgaon", "Ghagra", "Gohalakanda", "Hogla", "Jaria", "Khalishaur", "Narandia", "Purbadhala"]
  },
  "Sherpur": {
    "Jhenaigati": ["Dansail", "Gouripur", "Hatibandha", "Jhenaigati", "Kansa", "Malijhikanda", "Nolkura"],
    "Nakla": ["Baneshwardi", "Chandrakona", "Choraustadhar", "Gonopoddi", "Gourdwar", "Nokla", "Pathakata", "Talki", "Urpha"],
    "Nalitabari": ["Bagber", "Juganiya", "Kakorkandhi", "Koloshpar", "Morichpuran", "Nalitabari", "Nayabil", "Nonni", "Puraga", "Rajnogor", "Ramchondrokura", "Rupnarayankura"],
    "Sherpur Sadar": ["Bajitkhila", "Balairchar", "Betmari Ghughurakandi", "Chor Mochoriya", "Chorpokhimari", "Chorsherpur", "Dhola", "Gajir Khamar", "Kamararchor", "Kamariya", "Losmonpur", "Pakuriya", "Rouha", "Vatshala"],
    "Sreebardi": ["Bhelua", "Garjaripa", "Gosaipur", "Kakilakura", "Kharia Kazirchar", "Kurikahonia", "Ranishimul", "Singabaruna", "Sreebordi", "Tatihati"]
  },
};

/** Every Union under a given district+upazila — empty for a Thana (city
 *  corp areas use free-text detail instead) or for the handful of
 *  upazilas noted above with no union data available. */
export function unionsFor(district: string, upazila: string): string[] {
  return UNIONS_BY_UPAZILA[district]?.[upazila] ?? [];
}

/** Folds the free-text street address, the selected Upazila/Thana, its
 *  Union (rural areas only — Thanas have none, see unionsFor) and an
 *  optional landmark into the single string the backend's `address` field
 *  stores. `parseComposedAddress` below is the exact inverse — keep them in
 *  sync. `district` picks the correct "Upazila" vs "Thana" suffix. */
export function composeAddress(
  address: string,
  area: string,
  district: string,
  union: string,
  landmark: string,
): string {
  const thana = isThana(district, area);
  const suffix = thana ? "Thana" : "Upazila";
  let base = area ? `${address.trim()}, ${area} ${suffix}` : address.trim();
  if (!thana && union) base += `, ${union} Union`;
  return landmark.trim() ? `${base} (Landmark: ${landmark.trim()})` : base;
}

/** Reverses `composeAddress`: given a stored address and the district it
 *  belongs to, splits back out the free-text address, Upazila/Thana, Union
 *  and landmark so an edit form can show them in separate fields instead of
 *  one blob. Falls back to treating the whole string as free text (with
 *  the district's first upazila/union as a display default) when it
 *  doesn't match the composed shape — e.g. an address saved before this
 *  feature existed. */
export function parseComposedAddress(
  fullAddress: string,
  district: string,
): { address: string; upazila: string; union: string; landmark: string } {
  const validAreas = areasFor(district);
  const match = fullAddress.match(
    /^(.*?),\s*([^,]+?) (?:Upazila|Thana)(?:,\s*([^,()]+?) Union)?(?:\s*\(Landmark:\s*(.*?)\))?\s*$/,
  );
  const candidate = match?.[2]?.trim();
  if (match && candidate && validAreas.includes(candidate)) {
    const unions = unionsFor(district, candidate);
    const unionCandidate = match[3]?.trim();
    return {
      address: match[1].trim(),
      upazila: candidate,
      union: unionCandidate && unions.includes(unionCandidate) ? unionCandidate : (unions[0] ?? ""),
      landmark: (match[4] ?? "").trim(),
    };
  }
  const fallbackArea = validAreas[0] ?? "";
  return {
    address: fullAddress,
    upazila: fallbackArea,
    union: unionsFor(district, fallbackArea)[0] ?? "",
    landmark: "",
  };
}
