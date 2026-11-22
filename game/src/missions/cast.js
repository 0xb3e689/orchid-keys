// The people of the Orchid Keys story and the colour their lines are subtitled in.

export const CAST = {
  dez: { name: 'Dez Navarro', color: '#ff5fa2', bio: 'Back on the island after three years inside. Wants the family bar back.' },
  ro: { name: 'Mama Ro', color: '#7cf29a', bio: "Rosalind Quintero, Dez's aunt. Runs Suds & Spin and half the gossip in Palmetto Heights." },
  tiko: { name: 'Tiko', color: '#ffd23f', bio: 'Tiko Barnes, best mechanic in Port Halcyon, worst driver.' },
  val: { name: 'Val', color: '#c084fc', bio: 'Valentina Okoro owns the Velvet Lagoon and knows where every dollar on the Strip goes.' },
  shore: { name: 'Councilman Shore', color: '#ff8a5b', bio: 'Everett Shore wants a casino where the Salt Orchid stands.' },
  pike: { name: 'Captain Pike', color: '#5aa9ff', bio: "Harlan Pike, OKPD. Shore's man with a badge." },
  brick: { name: 'Brick Delacroix', color: '#e5e5e5', bio: "Shore's bodyguard. Big, patient, armed." },
  editor: { name: 'Editor Imani Cole', color: '#f1ede4', bio: 'Runs the Orchid Gazette and is not afraid of a councilman.' },
  radio: { name: 'Dispatch', color: '#9ad1ff', bio: 'OKPD radio chatter.' },
};

export const line = (who, text, time = null) => ({ who, text, time: time ?? Math.max(2.4, text.length * 0.055) });
