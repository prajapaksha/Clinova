import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SummaryTab } from './summary-tab.component';

describe('SummaryTab', () => {
  let fixture: ComponentFixture<SummaryTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryTab],
    }).compileComponents();
    fixture = TestBed.createComponent(SummaryTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
