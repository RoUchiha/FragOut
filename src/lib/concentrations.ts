export const concentrationOptions = [
 ['UNKNOWN','Unknown'],['EDT','EDT'],['EDP','EDP'],['EDC','Cologne'],
 ['PARFUM','Parfum'],['EXTRAIT','Extrait'],['ELIXIR','Elixir'],['MIST','Mist'],
 ['OIL','Oil'],['OTHER','Other'],
] as const;

export const concentrationCodes=concentrationOptions.map(([code])=>code);
