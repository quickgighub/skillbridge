import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Loader2, Shield, ExternalLink, CreditCard, Lock, AlertCircle, Copy, Check, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [usdtAmount, setUsdtAmount] = useState<number | null>(null);

  const planDetails = {
    regular: { name: 'Regular', price: 15, tier: 'regular' },
    pro: { name: 'Pro', price: 25, tier: 'pro' },
    vip: { name: 'VIP', price: 49, tier: 'vip' },
  };

  const currentPlan = plan && plan in planDetails ? planDetails[plan as keyof typeof planDetails] : null;
  
  // Tron Network USDT (TRC20) Address
  const tronAddress = 'TMo91D2bi4EQUGBQDQyFF7rvvNGHmETAU';
  const qrCodePath = '/qr/WhatsApp Image 2026-01-13 at 23.51.34.jpeg';

  useEffect(() => {
    console.log('Checkout useEffect triggered');
    console.log('User:', user);
    console.log('Plan from URL:', plan);
    console.log('Current Plan:', currentPlan);
    
    if (!user) {
      console.log('No user, redirecting to auth');
      navigate('/auth');
      return;
    }

    if (!currentPlan) {
      console.log('No valid plan, redirecting to pricing');
      navigate('/pricing');
      return;
    }

    // Convert USD to approximate USDT (1:1 for simplicity)
    setUsdtAmount(currentPlan.price);
  }, [user, currentPlan, navigate, plan]);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(tronAddress);
    setCopied(true);
    toast({
      title: 'Address copied!',
      description: 'Tron address copied to clipboard.',
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePayNow = async () => {
    console.log('Pay Now clicked');
    console.log('User:', user);
    console.log('Current Plan:', currentPlan);
    
    if (!user || !currentPlan) {
      console.error('Missing user or current plan');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('Setting payment initiated to true');
      setPaymentInitiated(true);

      // Create transaction record
      try {
        console.log('Creating transaction record...');
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'subscription',
            amount: -currentPlan.price,
            status: 'pending',
            description: `${currentPlan.name} Membership - USDT Payment Pending`,
            reference_id: `usdt_${Date.now()}_${user.id}`
          });

        if (transactionError) {
          console.warn('Transaction record not created:', transactionError);
        } else {
          console.log('Transaction record created');
        }
      } catch (dbError) {
        console.warn('Database operation failed:', dbError);
      }

      // Update profile
      try {
        console.log('Updating profile...');
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            membership_tier: currentPlan.tier,
            membership_expires_at: expiresAt.toISOString(),
            daily_tasks_used: 0,
            membership_status: 'pending_payment'
          })
          .eq('id', user.id);

        if (updateError) {
          console.warn('Profile update failed:', updateError);
        } else {
          console.log('Profile updated');
        }

        await refreshProfile();
      } catch (profileError) {
        console.warn('Profile update failed:', profileError);
      }

      toast({
        title: 'Payment Instructions',
        description: 'Please send USDT to the address shown. Your membership will be activated after verification.',
      });

      console.log('Setting timeout for dashboard redirect');
      // Redirect to dashboard after delay
      setTimeout(() => {
        console.log('Redirecting to dashboard');
        navigate('/dashboard');
      }, 10000);

    } catch (error: any) {
      console.error('Payment initiation error:', error);
      setError('There was an issue setting up your payment. Please try again or contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualVerify = () => {
    console.log('Manual verify clicked');
    setPaymentInitiated(false);
    toast({
      title: 'Returning to payment',
      description: 'Please complete the USDT transfer as shown.',
    });
  };

  console.log('Rendering checkout, currentPlan:', currentPlan);
  
  if (!currentPlan) {
    console.log('Returning null because no current plan');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pricing
        </Link>

        <div className="glass-card p-8 lg:p-12">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Complete Your Purchase</h1>
            <p className="text-muted-foreground">
              Upgrade to {currentPlan.name} membership
            </p>
          </div>

          <div className="mb-8 p-6 rounded-xl bg-secondary/30 border border-border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold text-foreground">
                {currentPlan.name} Membership
              </span>
              <span className="text-3xl font-bold text-primary">
                ${currentPlan.price}
                <span className="text-sm text-muted-foreground font-normal">/month</span>
              </span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Billed monthly</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Guaranteed payments after verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <span>Fast submission verification after job completion</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment Details</h2>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-purple-400 font-medium mb-1">USDT via Tron Network (TRC20)</p>
                    <p className="text-sm text-foreground">
                      Send USDT (TRC20) to the address below. Make sure to use the Tron Network.
                    </p>
                  </div>
                </div>
              </div>

              {/* QR Code Display */}
              <div className="glass-card p-6 text-center">
                <div className="flex flex-col items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-primary mb-2" />
                  <h3 className="font-semibold text-foreground">Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground mt-1">Scan with your crypto wallet app</p>
                </div>
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img 
                    src={qrCodePath} 
                    alt="Tron Address QR Code" 
                    className="w-48 h-48 object-contain"
                    onError={(e) => {
                      console.error('QR code image failed to load:', qrCodePath);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">If QR doesn't load, copy the address manually below</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Tron Address (TRC20):</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyAddress}
                      className="h-7 w-7 p-0"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-primary/5 px-3 py-2 rounded-lg overflow-x-auto">
                    <code className="text-sm md:text-base font-bold text-primary break-all">
                      {tronAddress}
                    </code>
                  </div>
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Copy this address to send USDT
                  </p>
                </div>

                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">Amount to Send:</span>
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">{usdtAmount} USDT</span>
                    <span className="text-sm text-muted-foreground">≈ ${currentPlan.price}.00</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Monthly subscription (TRC20 only)</p>
                </div>
              </div>

              <div className="glass-card p-4">
                <h3 className="font-medium text-foreground mb-3">Important Instructions:</h3>
                <ol className="space-y-2 text-sm text-muted-foreground pl-5 list-decimal">
                  <li><strong>Send exactly {usdtAmount} USDT</strong> (TRC20 token on Tron Network)</li>
                  <li><strong>Use only the Tron Network (TRC20)</strong> - Do NOT use ERC20 or other networks</li>
                  <li>Send from exchanges like Binance, OKX, Bybit, or any TRON-compatible wallet</li>
                  <li>Copy the address above or scan the QR code with your wallet</li>
                  <li>After sending, your membership will be activated within 24 hours</li>
                  <li>Keep your transaction hash (TXID) for reference</li>
                  <li>Contact support if you encounter any issues</li>
                </ol>
              </div>

              <div className="p-4 rounded-lg bg-blue-400/10 border border-blue-400/20">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-400 font-medium mb-1">Where to Get USDT (TRC20)?</p>
                    <p className="text-sm text-foreground">
                      You can buy and send USDT on Binance, OKX, Bybit, or other major exchanges. 
                      Make sure to select <strong>Tron Network (TRC20)</strong> when withdrawing.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-yellow-400 font-medium mb-1">Note</p>
                      <p className="text-sm text-foreground">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {paymentInitiated ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Payment Address Ready</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Please send <strong>{usdtAmount} USDT (TRC20)</strong> to the address shown above.
                Your membership will be activated within 24 hours after verification.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                <AlertCircle className="w-4 h-4" />
                <span>Returning to dashboard in 10 seconds...</span>
              </div>
              
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">Need to see the address again?</p>
                <Button
                  onClick={handleManualVerify}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Show Payment Details Again
                </Button>
              </div>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <span className="text-muted-foreground mb-2">Setting up payment...</span>
              <span className="text-xs text-muted-foreground">Please wait</span>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                onClick={handlePayNow}
                className="w-full h-14 text-lg font-semibold group"
                variant="hero"
                disabled={isProcessing}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Confirm and Show Payment Details
                <CheckCircle className="w-5 h-5 ml-2 group-hover:scale-110 transition-transform" />
              </Button>
              
              <div className="text-center">
                <Button
                  onClick={() => navigate('/pricing')}
                  variant="ghost"
                  size="sm"
                >
                  Cancel and return to pricing
                </Button>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              <p>Secure payment via Tron Network (TRC20)</p>
            </div>
            <p className="text-xs mb-2">Only send USDT on Tron Network. Other tokens will be lost.</p>
            <p>Need help? Contact freelance.skillbridge.com</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;