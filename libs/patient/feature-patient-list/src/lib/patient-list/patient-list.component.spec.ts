import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientListComponent } from './patient-list.component';

describe('PatientListComponent', () => {
  let fixture: ComponentFixture<PatientListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PatientListComponent] }).compileComponents();
    fixture = TestBed.createComponent(PatientListComponent);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
