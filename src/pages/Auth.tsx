import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Lock, 
  User, 
  Shield, 
  Eye, 
  EyeOff, 
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Redirect if user is already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    
    // Clear specific error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setApiError('');
    setVerificationSent(false);

    try {
      if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsSubmitting(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            setApiError('This email is already registered. Please sign in instead.');
          } else if (error.message.includes('User already registered')) {
            setApiError('This email is already registered. Please sign in.');
          } else {
            setApiError(error.message || 'Failed to create account. Please try again.');
          }
        } else {
          // Successfully signed up - show verification message
          setVerificationSent(true);
          // Clear form data
          setFormData({
            fullName: '',
            email: '',
            password: '',
            confirmPassword: '',
            acceptTerms: false,
          });
        }
      } else {
        const result = signInSchema.safeParse({
          email: formData.email,
          password: formData.password
        });
        
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach(err => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setIsSubmitting(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Invalid login')) {
            setApiError('Invalid email or password. Please try again.');
          } else if (error.message.includes('Email not confirmed')) {
            setApiError('Please verify your email address before logging in.');
            setVerificationSent(true);
          } else {
            setApiError(error.message || 'Failed to sign in. Please try again.');
          }
        }
      }
    } catch (err) {
      setApiError('An unexpected error occurred. Please try again.');
      console.error('Auth error:', err);
    }

    setIsSubmitting(false);
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, color: 'bg-gray-200', text: '' };
    
    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];
    const texts = ['Very Weak', 'Weak', 'Fair', 'Strong'];
    
    return {
      strength,
      color: colors[strength - 1] || 'bg-gray-200',
      text: texts[strength - 1] || '',
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">S</span>
              </div>
              <span className="text-xl font-bold text-foreground">
                Skill<span className="text-primary">Bridge</span>
              </span>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-muted-foreground">
              {isSignUp
                ? 'Start your freelancing journey today'
                : 'Sign in to access your dashboard'}
            </p>
          </div>

          {/* Verification Success Message */}
          {verificationSent && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900">Verification Email Sent!</h3>
                  <p className="text-green-700 text-sm mt-1">
                    A verification email has been sent to <strong>{formData.email || 'your email'}</strong>. 
                    Please check your inbox and verify your email address to continue.
                  </p>
                  <div className="mt-3 text-sm text-green-800 space-y-1">
                    <p className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Can't find the email? Check your spam folder.</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Once verified, click "Login" to access your dashboard.</span>
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVerificationSent(false);
                        setIsSignUp(false);
                      }}
                      className="text-green-700 border-green-300 hover:bg-green-100"
                    >
                      Go to Login
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVerificationSent(false)}
                      className="text-green-700 hover:bg-green-100"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {apiError && !verificationSent && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>{apiError}</span>
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="pl-10"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  disabled={isSubmitting}
                  required
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {isSignUp && formData.password && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength:</span>
                    <span className={`font-medium ${
                      passwordStrength.strength >= 4 ? 'text-green-600' :
                      passwordStrength.strength >= 3 ? 'text-yellow-600' :
                      passwordStrength.strength >= 2 ? 'text-orange-600' : 'text-red-600'
                    }`}>
                      {passwordStrength.text}
                    </span>
                  </div>
                  <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${passwordStrength.color} transition-all duration-300`}
                      style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="acceptTerms"
                      name="acceptTerms"
                      checked={formData.acceptTerms}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))
                      }
                      disabled={isSubmitting}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="acceptTerms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        I agree to the{' '}
                        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
                          <DialogTrigger asChild>
                            <button 
                              type="button" 
                              className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowTermsDialog(true);
                              }}
                              disabled={isSubmitting}
                            >
                              Terms of Service
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Terms of Service</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-sm">
                              {/* Terms content - same as before */}
                              <p>Terms content here...</p>
                            </div>
                          </DialogContent>
                        </Dialog>{' '}
                        and{' '}
                        <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
                          <DialogTrigger asChild>
                            <button 
                              type="button" 
                              className="text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={(e) => {
                                e.preventDefault();
                                setShowPrivacyDialog(true);
                              }}
                              disabled={isSubmitting}
                            >
                              Privacy Policy
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Privacy Policy</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-sm">
                              {/* Privacy content - same as before */}
                              <p>Privacy content here...</p>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </label>
                      <p className="text-xs text-muted-foreground">
                        You must agree to our Terms of Service and Privacy Policy to create an account.
                      </p>
                      {errors.acceptTerms && (
                        <p className="text-sm text-destructive">{errors.acceptTerms}</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Button 
              type="submit" 
              variant="hero" 
              className="w-full" 
              disabled={isSubmitting || verificationSent}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrors({});
                  setApiError('');
                  setVerificationSent(false);
                  // Reset form when switching modes
                  setFormData({
                    fullName: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    acceptTerms: false,
                  });
                }}
                className="text-primary hover:underline font-medium disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-secondary/20 border-l border-border p-8">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Join Thousands of Professionals
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Access curated jobs, guaranteed payments, and build your professional reputation.
          </p>
          <div className="flex items-center justify-center gap-6 md:gap-8 text-sm text-muted-foreground">
            <div>
              <div className="text-xl md:text-2xl font-bold text-foreground">$2M+</div>
              <div>Paid to freelancers</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xl md:text-2xl font-bold text-foreground">98%</div>
              <div>Satisfaction rate</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-xl md:text-2xl font-bold text-foreground">24/7</div>
              <div>Support</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;