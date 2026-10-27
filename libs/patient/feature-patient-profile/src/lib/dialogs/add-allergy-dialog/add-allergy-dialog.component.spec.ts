import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddAllergyDialog } from './add-allergy-dialog.component';

describe('AddAllergyDialog', () => {
  let fixture: ComponentFixture<AddAllergyDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAllergyDialog],
    }).compileComponents();
    fixture = TestBed.createComponent(AddAllergyDialog);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
