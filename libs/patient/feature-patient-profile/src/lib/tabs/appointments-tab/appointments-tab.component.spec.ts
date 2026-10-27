import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppointmentsTab } from './appointments-tab.component';

describe('AppointmentsTab', () => {
  let fixture: ComponentFixture<AppointmentsTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentsTab],
    }).compileComponents();
    fixture = TestBed.createComponent(AppointmentsTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
