import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MedicalTab } from './medical-tab.component';

describe('MedicalTab', () => {
  let fixture: ComponentFixture<MedicalTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalTab],
    }).compileComponents();
    fixture = TestBed.createComponent(MedicalTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
