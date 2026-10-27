import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingTab } from './billing-tab.component';

describe('BillingTab', () => {
  let fixture: ComponentFixture<BillingTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingTab],
    }).compileComponents();
    fixture = TestBed.createComponent(BillingTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
