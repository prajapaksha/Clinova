import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarPageComponent } from './calendar-page.component';

describe('CalendarPageComponent', () => {
  let fixture: ComponentFixture<CalendarPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarPageComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
