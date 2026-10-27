import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditDemographicsDialog } from './edit-demographics-dialog.component';

describe('EditDemographicsDialog', () => {
  let fixture: ComponentFixture<EditDemographicsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditDemographicsDialog],
    }).compileComponents();
    fixture = TestBed.createComponent(EditDemographicsDialog);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
