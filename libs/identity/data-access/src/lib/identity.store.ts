import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type { User, UserId, UserRole, AuditLogEntry } from '@clinova/identity/domain';
import { IdentityApiService, type UpdateUserDto, type CreateUserDto } from './identity.api';

interface IdentityState {
  currentUser: User | null;
  selectedUserId: string | null;
  auditLog: AuditLogEntry[];
  loading: boolean;
  error: string | null;
}

export const IdentityStore = signalStore(
  { providedIn: 'root' },
  withEntities<User>(),
  withState<IdentityState>({
    currentUser: null,
    selectedUserId: null,
    auditLog: [],
    loading: false,
    error: null,
  }),
  withComputed(({ entities, selectedUserId, currentUser }) => ({
    selectedUser: computed(() => entities().find(u => u.id === selectedUserId()) ?? null),
    activeUsers: computed(() => entities().filter(u => u.isActive)),
    isLoggedIn: computed(() => currentUser() !== null),
  })),
  withMethods((store, api = inject(IdentityApiService)) => ({
    loadUsers: rxMethod<{ role?: UserRole; isActive?: boolean } | void>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.findAll(filters ?? undefined).pipe(
        tapResponse({
          next: users => patchState(store, setAllEntities(users), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadCurrentUser: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => api.findMe().pipe(
        tapResponse({
          next: user => patchState(store, { currentUser: user, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    createUser: rxMethod<CreateUserDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.create(dto).pipe(
        tapResponse({
          next: user => patchState(store, setEntity(user), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    updateUser: rxMethod<{ id: UserId; dto: UpdateUserDto }>(pipe(
      switchMap(({ id, dto }) => api.update(id, dto).pipe(
        tapResponse({
          next: user => patchState(store, setEntity(user)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadAuditLog: rxMethod<{ patientId?: string; userId?: string }>(pipe(
      switchMap(filters => api.getAuditLog(filters).pipe(
        tapResponse({
          next: log => patchState(store, { auditLog: log }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    selectUser(id: string) {
      patchState(store, { selectedUserId: id });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
