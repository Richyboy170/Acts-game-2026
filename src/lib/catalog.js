export const GAMES = [
  { id: 'sandwich', name: 'Sandwich', icon: '🥪', description: 'Build it together. Score it together.' },
  { id: 'balloon-direction', name: 'Balloon Direction', icon: '🎈', description: 'Guide the balloon to victory.' },
  { id: 'water-cup', name: 'Water Cup', icon: '🏆', description: 'Balance, timing, and teamwork.' },
  { id: 'get-the-ball-off', name: 'Get the Ball Off', icon: '⚽', description: 'One final spell of teamwork.' },
];

export const TEAMS = [
  { id: 'cat', name: 'Cat', color: '#d8aa45', ink: '#211a3b', image: '/assets/house-icon/cat_0.jfif' },
  { id: 'dragon', name: 'Dragon', color: '#ac3d42', ink: '#252a32', image: '/assets/house-icon/dragon_0.jfif' },
  { id: 'monkey', name: 'Monkey', color: '#d47a36', ink: '#713d25', image: '/assets/house-icon/monkey_0.jfif' },
  { id: 'owl', name: 'Owl', color: '#9571a5', ink: '#342343', image: '/assets/house-icon/owl_0.jfif' },
  { id: 'sheep', name: 'Sheep', color: '#d883a1', ink: '#48283c', image: '/assets/house-icon/sheep_0.jfif' },
  { id: 'snake', name: 'Snake', color: '#39775d', ink: '#17392e', image: '/assets/house-icon/snake_0.jfif' },
  { id: 'unicorn', name: 'Unicorn', color: '#9fc8d5', ink: '#25374b', image: '/assets/house-icon/unicorn_0.jfif' },
  { id: 'wolf', name: 'Wolf', color: '#758ba4', ink: '#273245', image: '/assets/house-icon/wolf_0.jfif' },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((team) => [team.id, team]));
export const GAME_BY_ID = Object.fromEntries(GAMES.map((game) => [game.id, game]));

export const PHASE_BACKGROUNDS = {
  1: '/assets/background-phase/phase1.jpg',
  2: '/assets/background-phase/phase2.webp',
  3: '/assets/background-phase/phase3.webp',
  4: '/assets/background-phase/phase4.jfif',
  5: '/assets/background-phase/phase5.jpg',
};
