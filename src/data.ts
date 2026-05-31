import { RocketModel, BoosterOption, PayloadTarget, KalamQuote } from './types';

export const INDIAN_ROCKETS: Record<string, RocketModel> = {
  LVM3: {
    id: 'LVM3',
    name: 'LVM3 - Baahubali',
    hindiName: 'एलवीएम3 - बाहुबली',
    description: 'ISRO\'s heaviest operational launcher, nicknamed "Baahubali" for its towering power. It famously inserted Chandrayaan-3 into a precise lunar transfer orbit, opening the path to India\'s historic moon landing.',
    specs: {
      height: '43.5 meters',
      diameter: '4.0 meters',
      liftOffMass: '640 tonnes',
      stages: 3,
      payloadCapacity: '4,000 kg (GTO) / 8,000 kg (LEO)',
    },
  },
  PSLV: {
    id: 'PSLV',
    name: 'PSLV - Workhorse',
    hindiName: 'पीएसएलवी - वर्कहॉर्स',
    description: 'The "Workhorse of ISRO", boasting a versatile multi-stage configuration combining solid and liquid propulsion. Champion of legendary missions like Chandrayaan-1, Mangalyaan (Mars Orbiter Mission), and the world-record launch of 104 satellites on a single flight.',
    specs: {
      height: '44.0 meters',
      diameter: '2.8 meters',
      liftOffMass: '320 tonnes',
      stages: 4,
      payloadCapacity: '1,425 kg (Sub-GTO) / 1,750 kg (SSPO)',
    },
  },
  SSLV: {
    id: 'SSLV',
    name: 'SSLV - Small Tech',
    hindiName: 'एसएसएलवी - स्माल टेक',
    description: 'India\'s agile, sleek, cost-effective mini-rocket designed to deploy small satellites on demand. Capable of being fully assembled in just 72 hours by a tiny team of 6 people, providing rapid space access.',
    specs: {
      height: '34.0 meters',
      diameter: '2.0 meters',
      liftOffMass: '120 tonnes',
      stages: 3,
      payloadCapacity: '500 kg (Low Earth Orbit)',
    },
  },
};

export const BOOSTER_OPTIONS: Record<string, BoosterOption> = {
  'Solid Strapon': {
    id: 'Solid Strapon',
    name: 'Solid Strapon',
    hindiName: 'सॉलिड स्ट्रैप-ऑन बूस्टर्स (मैक्सिमम थ्रस्ट)',
    thrust: '10,200 kN (S200 Type)',
    isp: '274 seconds',
    description: 'Twin high-energy solid rocket boosters providing overwhelming raw power during the critical initial seconds of liftoff.',
  },
  'Liquid Core': {
    id: 'Liquid Core',
    name: 'Liquid Core',
    hindiName: 'लिक्विड कोर बूस्टर्स (ज्यादा कंट्रोल)',
    thrust: '1,600 kN (L110 Type)',
    isp: '293 seconds',
    description: 'Vikas liquid engines providing precise throttled vector control during liftoff. Ideal for precise trajectory adjustments.',
  },
  'No Booster': {
    id: 'No Booster',
    name: 'No Booster',
    hindiName: 'बिना बूस्टर (हल्का पेलोड)',
    thrust: '0 kN',
    isp: 'N/A',
    description: 'No external supplementary boosters. Ideal for lightweight spacecraft that rely entirely on the core stage to ascend efficiently.',
  },
};

export const PAYLOAD_TARGETS: Record<string, PayloadTarget> = {
  'Moon Orbit': {
    id: 'Moon Orbit',
    name: 'Chandrayaan Mission (Moon)',
    hindiName: 'चंद्रयान मिशन (Moon Orbit)',
    targetOrbit: 'Trans-Lunar Injection (TLI)',
    distance: '384,400 km',
    description: 'A deep space journey to lunar orbit, paving the way for South Pole landings to analyze water ice and regolith.',
  },
  'Mars Mission': {
    id: 'Mars Mission',
    name: 'Mangalyaan Mission (Mars)',
    hindiName: 'मंगलयान-2 मिशन (Mars Orbit)',
    targetOrbit: 'Mars Orbit Insertion (MOI)',
    distance: '225,000,000 km',
    description: 'An ambitious interplanetary mission to examine outer atmosphere signatures, topography, and explore methane trace gas.',
  },
  'Earth Weather': {
    id: 'Earth Weather',
    name: 'Earth Meteorological Satellite',
    hindiName: 'मौसम सैटेलाइट (Earth Orbit)',
    targetOrbit: 'Sun-Synchronous Polar Orbit (SSPO)',
    distance: '820 km',
    description: 'Deploys advanced multi-spectral imaging instruments to monitor Indian subcontinent weather patterns, cyclones, and oceans.',
  },
  'Gaganyaan Mission': {
    id: 'Gaganyaan Mission',
    name: 'Gaganyaan Crewed Mission',
    hindiName: 'गगनयान मिशन (Gaganyaan LEO)',
    targetOrbit: 'Low Earth Orbit (LEO)',
    distance: '400 km',
    description: 'India\'s historic crewed spacecraft program, aiming to safely place three astronauts into a 400 km circular orbit and return them securely.',
  },
};

export const KALAM_QUOTES: KalamQuote[] = [
  {
    quote: "If you want to shine like a sun, first burn like a sun.",
    hindiQuote: "अगर तुम सूरज की तरह चमकना चाहते हो, तो पहले सूरज की तरह जलना सीखो।",
    context: "On dedication and the price of excellence.",
  },
  {
    quote: "Failure will never overtake me if my determination to succeed is strong enough.",
    hindiQuote: "असफलता मुझे कभी पछाड़ नहीं सकती यदि सफल होने का मेरा संकल्प पर्याप्त मजबूत है।",
    context: "Encouragement during intense developmental setbacks.",
  },
  {
    quote: "All of us do not have equal talent. But, all of us have an equal opportunity to develop our talents.",
    hindiQuote: "हम सभी के पास समान प्रतिभा नहीं होती। लेकिन, हम सभी के पास अपनी प्रतिभा को विकसित करने का समान अवसर होता है।",
    context: "Address to students on personal growth and democratic potential.",
  },
  {
    quote: "Dreams are not those which you see while sleeping, dreams are those which don't let you sleep.",
    hindiQuote: "सपने वो नहीं हैं जो आप सोते हुए देखते हैं, सपने वो हैं जो आपको सोने नहीं देते।",
    context: "Inspiring youth to pursue transformative, visionary missions.",
  },
  {
    quote: "You have to dream before your dreams can come true.",
    hindiQuote: "इससे पहले कि आपके सपने सच हों, आपको सपने देखने होंगे।",
    context: "A call to cultivate creative imagination as scientific foundations.",
  },
  {
    quote: "Difficulties in your life do not come to destroy you, but to help you realize your hidden potential and power.",
    hindiQuote: "आपके जीवन में कठिनाइयाँ आपको नष्ट करने नहीं आतीं, बल्कि आपकी छिपी हुई क्षमता और शक्ति को महसूस करने में मदद करने आती हैं।",
    context: "Guidance on resilience through hardships.",
  },
];
