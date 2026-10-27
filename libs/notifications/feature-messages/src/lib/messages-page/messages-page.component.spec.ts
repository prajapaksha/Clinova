import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessagesPage } from './messages-page.component';

describe('MessagesPage', () => {
  let fixture: ComponentFixture<MessagesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MessagesPage] }).compileComponents();
    fixture = TestBed.createComponent(MessagesPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
