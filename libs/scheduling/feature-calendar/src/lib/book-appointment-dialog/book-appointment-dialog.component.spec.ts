import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookAppointmentDialog } from './book-appointment-dialog.component';

describe('BookAppointmentDialog', () => {
  let fixture: ComponentFixture<BookAppointmentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookAppointmentDialog],
    }).compileComponents();
    fixture = TestBed.createComponent(BookAppointmentDialog);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
