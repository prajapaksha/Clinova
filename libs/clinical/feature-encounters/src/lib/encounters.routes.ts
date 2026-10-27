import { Route } from '@angular/router';

export const ENCOUNTERS_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () => import('./encounters-page/encounters-page.component').then(m => m.EncountersPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./encounter-start/encounter-start.component').then(m => m.EncounterStartComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./encounter-editor/encounter-editor.component').then(m => m.EncounterEditorComponent),
  },
];