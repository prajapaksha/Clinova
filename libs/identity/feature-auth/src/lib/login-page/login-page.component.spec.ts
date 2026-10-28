import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { LoginPage } from './login-page.component';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoginPage], providers: [provideRouter([]), provideHttpClient()] }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
