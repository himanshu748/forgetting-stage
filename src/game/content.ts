import type { Character } from '../engine/types.ts';

export type PremiseOption = {
  id: string;
  eyebrow: string;
  title: string;
  premise: string;
};

export const CAST: Character[] = [
  {
    name: 'Meera',
    emoji: 'M',
    persona: 'the bride',
    style: 'brisk and certain of everything',
  },
  {
    name: 'Arun',
    emoji: 'A',
    persona: 'the groom',
    style: 'romantic and permanently one step behind',
  },
  {
    name: 'Auntie',
    emoji: 'T',
    persona: 'an aunt in the family',
    style: 'loudly opinionated, with a private version of every family story',
  },
];

export const PREMISES: PremiseOption[] = [
  {
    id: 'wedding',
    eyebrow: 'Family farce',
    title: 'Nobody knows the bride',
    premise: 'a wedding where nobody can agree who is marrying whom',
  },
  {
    id: 'society',
    eyebrow: 'Housing drama',
    title: 'The missing water tank',
    premise: 'a housing society meeting about a water tank that may never have existed',
  },
  {
    id: 'cricket',
    eyebrow: 'Club mystery',
    title: 'The disputed final over',
    premise: 'a cricket club dinner where every guest remembers a different final over',
  },
];

export const OPENINGS: Record<string, string> = {
  wedding:
    'Marigolds crowd the ceiling while three families wait for a bride whose name is printed nowhere.',
  society:
    'The residents gather beneath a dry tap as the secretary unveils minutes from a meeting nobody attended.',
  cricket:
    'A dented trophy sits between old teammates who cannot agree which team won it.',
};

export const DEMO_LINES: Record<string, string[][]> = {
  wedding: [
    [
      'I chose every marigold myself, so naturally this is my wedding.',
      'Aishwarya will arrive after the band learns our song.',
      'Premali has always wanted a winter wedding, even in August.',
    ],
    [
      'Arun promised me this exact hall beside the old cinema.',
      'The ceremony is in Jaipur. This room is only the rehearsal.',
      'The groom is a dentist from Surat named Mihir.',
    ],
    [
      'My red veil proves the invitation said Meera.',
      'The invitation was blue and clearly named Kavya.',
      'There was never an invitation. I announced it at breakfast.',
    ],
    [
      'The priest is waiting for me beneath the mango leaves.',
      'That man is a caterer. The priest is on the roof.',
      'The roof is the venue now. I booked it personally.',
    ],
    [
      'I will marry Arun before anyone invents another bride.',
      'I came here to marry Naina, who is standing behind the curtain.',
      'Naina is the photographer. The bride is obviously Premali.',
    ],
  ],
  society: [
    [
      'The tank was installed during my term and painted sunrise pink.',
      'I inspected a silver tank on Tuesday beside the east stairwell.',
      'There is no east stairwell. The tank is underground.',
    ],
    [
      'The maintenance ledger lists twelve thousand litres.',
      'It holds eight thousand and belongs to the next building.',
      'We sold it last Diwali to pay for the lift music.',
    ],
    [
      'I have the only key to the pump room.',
      'The pump room became a yoga studio in March.',
      'That studio is the old generator room. The pump is on the terrace.',
    ],
    [
      'The water arrives every morning at six.',
      'It arrives on alternate Thursdays after lunch.',
      'Water is delivered by tanker only when I approve the driver.',
    ],
    [
      'We should find the tank before voting on its colour.',
      'We voted last year. It is officially peacock green.',
      'The vote was for curtains. The tank has always been yellow.',
    ],
  ],
  cricket: [
    [
      'I hit the winning six over long-on with one ball left.',
      'Meera was twelve and kept score from the pavilion.',
      'Arun was bowled first ball. I carried the chase.',
    ],
    [
      'The final was at Lucknow Club under floodlights.',
      'We played at noon in Kanpur on a matting wicket.',
      'It rained in Delhi, so the match moved indoors.',
    ],
    [
      'The trophy says champions of 2018.',
      'It says runners-up, 2016, in very small letters.',
      'That engraving belongs to another trophy entirely.',
    ],
    [
      'I bowled the final over and defended four runs.',
      'There was no final over because the umpire disappeared.',
      'I was the umpire. I awarded the match by handwriting.',
    ],
    [
      'The scorebook will settle every detail.',
      'I burned it after the committee accused me of arithmetic.',
      'The scorebook is safe in my almirah beside the team goat.',
    ],
  ],
};

export const CURTAINS: Record<string, string> = {
  wedding:
    'The band strikes three wedding songs at once as every bride walks toward a different groom.',
  society:
    'The meeting adjourns after approving repairs to a tank that remains completely unlocated.',
  cricket:
    'They raise the disputed trophy together, each celebrating a match the others never played.',
};
