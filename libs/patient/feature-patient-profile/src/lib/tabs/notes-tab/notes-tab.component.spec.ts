import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotesTab } from './notes-tab.component';

describe('NotesTab', () => {
  let fixture: ComponentFixture<NotesTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotesTab],
    }).compileComponents();
    fixture = TestBed.createComponent(NotesTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
