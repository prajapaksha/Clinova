import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientProfileComponent } from './patient-profile.component';

describe('PatientProfileComponent', () => {
  let fixture: ComponentFixture<PatientProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientProfileComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PatientProfileComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
