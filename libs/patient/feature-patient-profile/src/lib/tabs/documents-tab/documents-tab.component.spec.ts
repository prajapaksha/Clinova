import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentsTab } from './documents-tab.component';

describe('DocumentsTab', () => {
  let fixture: ComponentFixture<DocumentsTab>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsTab],
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentsTab);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
