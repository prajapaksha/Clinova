import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocCategoryDialog } from './doc-category-dialog.component';

describe('DocCategoryDialog', () => {
  let fixture: ComponentFixture<DocCategoryDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocCategoryDialog],
    }).compileComponents();
    fixture = TestBed.createComponent(DocCategoryDialog);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
