import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillingPage } from './billing-page.component';

describe('BillingPage', () => {
  let fixture: ComponentFixture<BillingPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BillingPage] }).compileComponents();
    fixture = TestBed.createComponent(BillingPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
