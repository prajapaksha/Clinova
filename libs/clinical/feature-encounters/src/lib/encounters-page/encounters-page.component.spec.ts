import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EncountersPage } from './encounters-page.component';

describe('EncountersPage', () => {
  let fixture: ComponentFixture<EncountersPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EncountersPage] }).compileComponents();
    fixture = TestBed.createComponent(EncountersPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
