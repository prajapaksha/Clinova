import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PatientNewComponent } from './patient-new.component';

describe('PatientNewComponent', () => {
  let fixture: ComponentFixture<PatientNewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientNewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PatientNewComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
