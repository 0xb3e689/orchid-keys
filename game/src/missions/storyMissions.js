// "Salt & Neon", the Orchid Keys story in seven missions. Dez Navarro comes home to find
// Councilman Shore bulldozing the family beach bar for a casino, and works with his aunt,
// a mechanic and a club owner to bring Shore and his badge-wearing muscle down.
import { CITY } from '../config.js';
import { LANDMARKS, blockCenter, roadLine } from '../world/cityPlan.js';
import { line } from './cast.js';
import { action, destroyTagged, eliminate, enterTagged, getAnyCar, goTo, loseWanted, pickUp, say, setWanted, wait } from './missionSteps.js';

const H = CITY.half;
const at = (id, dx = 0, dz = 0) => ({ x: LANDMARKS[id].x + dx, z: LANDMARKS[id].z + dz });
const BRINE_WAREHOUSE = { x: roadLine(1) - 8, z: blockCenter(6) + 30 };
const SEAFOAM_HOTEL = { x: blockCenter(3), z: roadLine(8) - 4 };
const YACHT_GATE = { x: -H - 22, z: blockCenter(6) };
const YACHT_DECK = { x: -H - 60, z: blockCenter(6) };

export const STORY_MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    giver: null,
    reward: { money: 500, respect: 5 },
    steps: [
      say(line('ro', 'Desmond Navarro! Three years and you walk in like you went out for milk.'),
        line('dez', 'Missed you too, Tia. What happened to the Salt Orchid? There is a fence around it.'),
        line('ro', 'Councilman Shore happened. He wants a casino on our beach. Go see Tiko, he kept your things.')),
      getAnyCar('Steal a car: walk up to one and press F.'),
      goTo(at('garage', 6, 0), "Drive to Tiko's Body Shop in Port Halcyon.", { vehicle: 'any', radius: 5, label: "TIKO'S" }),
      say(line('tiko', 'Dez! Is that a stolen Marlin? Never mind. Welcome home, brother.'),
        line('tiko', "Shore's people leaned on everybody. If you want the bar back, you'll need money and friends."),
        line('tiko', 'I have a buyer overseas. Steal the cars on my export list, drive them in, I pay cash.'),
        line('tiko', 'Ro has work for you too. Press M for the map, Esc to check my list.')),
    ],
  },
  {
    id: 'washDay',
    title: 'Wash Day',
    giver: 'safehouse',
    reward: { money: 900, respect: 6 },
    steps: [
      say(line('ro', 'The Seafoam Hotel sends their laundry to me, and Val at the Velvet Lagoon pays me to wash... other things.'),
        line('ro', 'Take the van, collect the bags at the Seafoam, and get them to Val before her doors open.')),
      action((ctx) => ctx.game.spawnMissionVehicle('bayline', 0xffffff, LANDMARKS.safehouse.x + 6, LANDMARKS.safehouse.z + 4, Math.PI / 2, 'laundryVan')),
      enterTagged('laundryVan', "Get in Mama Ro's van."),
      goTo(SEAFOAM_HOTEL, 'Collect the laundry at the Seafoam Hotel on Coral Beach.', { vehicle: 'laundryVan', radius: 5, label: 'SEAFOAM' }),
      say(line('dez', 'These bags are heavier than towels.'), line('ro', 'Do not open them, mijo. Drive.')),
      goTo(at('club', -6, 0), 'Deliver the bags to the Velvet Lagoon on the Lumen Strip.', { vehicle: 'laundryVan', radius: 5, timeLimit: 150, label: 'VELVET LAGOON' }),
      say(line('val', "So you're Ro's nephew. You drive like you mean it. Come back when you want real work.")),
    ],
  },
  {
    id: 'neonDebt',
    title: 'Neon Debt',
    giver: 'club',
    reward: { money: 1600, respect: 10 },
    steps: [
      say(line('val', 'The Brine Kings borrowed from me to open a chop shop by the docks. They forgot to pay me back.'),
        line('val', 'Take this. A Viper 9. Collect what they owe and do not let them keep the change.')),
      action((ctx) => ctx.game.player.giveWeapon('pistol', 60)),
      say(line('dez', 'Right mouse to aim, left to shoot. Like riding a bike.')),
      goTo(BRINE_WAREHOUSE, 'Go to the Brine Kings warehouse in Port Halcyon.', { radius: 7, label: 'BRINE KINGS' }),
      action((ctx) => {
        const g = ctx.game.gangs;
        for (let i = 0; i < 5; i++) g.spawn(BRINE_WAREHOUSE.x - 6 + (i % 3) * 5, BRINE_WAREHOUSE.z - 14 - Math.floor(i / 3) * 4, { tag: 'brine', weapon: i < 3 ? 'pistol' : 'fists', look: 'brine' });
      }),
      say(line('tiko', 'Radio check: those are Brine Kings. Watch yourself.')),
      eliminate('brine', 'Take out the Brine Kings.'),
      pickUp({ x: BRINE_WAREHOUSE.x - 2, z: BRINE_WAREHOUSE.z - 10 }, 'cash', "Grab Val's money."),
      goTo(at('club', -6, 0), 'Bring the money back to the Velvet Lagoon.', { radius: 4, label: 'VELVET LAGOON' }),
      say(line('val', 'All of it. You are useful, Dez Navarro.')),
    ],
  },
  {
    id: 'hotPink',
    title: 'Hot Pink',
    giver: 'garage',
    reward: { money: 2500, respect: 12, car: 'kestrel' },
    steps: [
      say(line('tiko', "Shore's son keeps a pink Kestrel GT at Halcyon Marina. Insured for more than this whole street."),
        line('tiko', 'Steal it, shake the cops, bring it here in one piece, and it is yours.')),
      goTo(at('marina', 14, 0), 'Go to Halcyon Marina.', { radius: 6, label: 'MARINA' }),
      action((ctx) => {
        ctx.game.spawnMissionVehicle('kestrel', 0xff70a6, LANDMARKS.marina.x - 2, LANDMARKS.marina.z, Math.PI / 2, 'kestrel', true);
        const g = ctx.game.gangs;
        g.spawn(LANDMARKS.marina.x + 6, LANDMARKS.marina.z + 4, { tag: 'marina', weapon: 'pistol', look: 'goon' });
        g.spawn(LANDMARKS.marina.x + 4, LANDMARKS.marina.z - 4, { tag: 'marina', weapon: 'fists', look: 'goon' });
      }),
      enterTagged('kestrel', 'Steal the pink Kestrel GT.'),
      say(line('radio', 'All units, alarm at Halcyon Marina, pink Kestrel GT, suspect armed.')),
      setWanted(2),
      goTo(at('garage', 6, 0), "The alarm went off! <b>Lose the cops</b>, then deliver the Kestrel to <b>Tiko's Body Shop</b>.", { vehicle: 'kestrel', radius: 5, slow: true, noHeat: true, label: "TIKO'S" }),
      say(line('tiko', 'Look at her. Not a scratch. Okay, a scratch. She lives in my garage now, under your name.')),
    ],
  },
  {
    id: 'paperTrail',
    title: 'Paper Trail',
    giver: 'club',
    reward: { money: 3200, respect: 14 },
    steps: [
      say(line('val', "Shore's aide drives a ledger to the port every week: every bribe, every permit. Including the one for your bar."),
        line('val', 'His van just left Meridian. Stop it, any way you like, and get me that book.')),
      action((ctx) => ctx.game.spawnCourierVan()),
      getAnyCar('Get a car, fast.'),
      destroyTagged('courier', "Chase down and wreck the aide's van."),
      pickUp((ctx) => ctx.state.wreck ?? { x: ctx.game.player.pos.x + 3, z: ctx.game.player.pos.z }, 'ledger', 'Grab the ledger from the wreck.'),
      setWanted(1),
      goTo(at('safehouse', 0, 3), 'Take the ledger to Mama Ro.', { radius: 4, label: 'SUDS & SPIN' }),
      say(line('ro', 'Dios mio. Every name on this island is in here. Pike too.')),
    ],
  },
  {
    id: 'frontPage',
    title: 'Front Page',
    giver: 'safehouse',
    reward: { money: 4000, respect: 16 },
    steps: [
      say(line('ro', 'Imani Cole at the Orchid Gazette will print it. Shore owns the police, not the paper.'),
        line('dez', 'Then Pike will try to stop me getting there.')),
      goTo(at('gazette', 0, -3), 'Deliver the ledger to the Orchid Gazette.', { radius: 5, label: 'GAZETTE' }),
      say(line('editor', 'This is real. Front page tomorrow. Now go, Pike has every car on the island coming.'),
        line('pike', 'Navarro! You should have stayed in your cell. All units: shoot on sight.')),
      setWanted(4),
      loseWanted("Pike's men are everywhere. Lose the cops."),
      say(line('tiko', 'You made it? Ha! Shore is running to his yacht. Meet Ro at the Salt Orchid.')),
    ],
  },
  {
    id: 'lastCall',
    title: 'Last Call',
    giver: 'saltOrchid',
    reward: { money: 10000, respect: 25 },
    steps: [
      say(line('ro', 'Look at it. Fence, bulldozers. Your grandfather built this bar with his hands.'),
        line('dez', "Shore is on the Gilded Heron at the yacht pier. I'm ending this tonight."),
        line('ro', 'Then come back for dinner. Not in a box.')),
      goTo(YACHT_GATE, 'Go to the yacht pier in Port Halcyon.', { radius: 7, label: 'YACHT PIER' }),
      action((ctx) => {
        const g = ctx.game.gangs;
        for (let i = 0; i < 6; i++) g.spawn(YACHT_GATE.x - 12 - i * 5, YACHT_GATE.z + (i % 2 ? 4 : -4), { tag: 'crew', weapon: i % 3 === 0 ? 'smg' : 'pistol', look: 'goon' });
        g.spawn(YACHT_DECK.x + 6, YACHT_DECK.z, { tag: 'crew', weapon: 'shotgun', look: 'brick', health: 420, accuracy: 0.65, name: 'Brick Delacroix' });
      }),
      say(line('brick', "Councilman's busy. You can talk to me.")),
      eliminate('crew', "Fight through Shore's crew and Brick Delacroix."),
      goTo(YACHT_DECK, 'Board the Gilded Heron.', { vehicle: 'none', radius: 4, label: 'GILDED HERON' }),
      say(line('shore', 'Navarro. Name a price. Everyone on this island has one.'),
        line('dez', "The Salt Orchid isn't for sale. And the Gazette already has your ledger."),
        line('radio', 'All units: arrest warrant issued for Councilman Everett Shore and Captain Harlan Pike.'),
        line('ro', 'Come home, Desmond. The bar opens Friday. First round is on the house.')),
      wait(0.5),
    ],
  },
];
