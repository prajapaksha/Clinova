import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StaffPage } from './staff-page.component';

describe('StaffPage', () => {
  let fixture: ComponentFixture<StaffPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StaffPage] }).compileComponents();
    fixture = TestBed.createComponent(StaffPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
