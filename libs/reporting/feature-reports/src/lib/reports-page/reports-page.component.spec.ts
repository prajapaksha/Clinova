import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportsPage } from './reports-page.component';

describe('ReportsPage', () => {
  let fixture: ComponentFixture<ReportsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportsPage] }).compileComponents();
    fixture = TestBed.createComponent(ReportsPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
