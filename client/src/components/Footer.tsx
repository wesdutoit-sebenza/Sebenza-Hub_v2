import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t border-slate bg-graphite">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold mb-4 text-white-brand" data-testid="text-footer-product">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/recruiters"
                  data-testid="link-footer-recruiters" 
                  className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block"
                >
                  For Recruiters
                </Link>
              </li>
              <li>
                <Link 
                  href="/businesses"
                  data-testid="link-footer-businesses" 
                  className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block"
                >
                  For Businesses
                </Link>
              </li>
              <li>
                <Link 
                  href="/individuals"
                  data-testid="link-footer-individuals" 
                  className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block"
                >
                  For Individuals
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-white-brand" data-testid="text-footer-legal">Legal</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" data-testid="link-footer-privacy" className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" data-testid="link-footer-popia" className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block">
                  POPIA Compliance
                </a>
              </li>
              <li>
                <a href="#" data-testid="link-footer-terms" className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-white-brand" data-testid="text-footer-contact">Contact</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:hello@yourdomain.co.za"
                  data-testid="link-footer-email"
                  className="text-sm text-slate hover:text-amber hover-elevate px-2 py-1 rounded-md inline-block"
                >
                  hello@yourdomain.co.za
                </a>
              </li>
              <li className="text-sm text-slate flex items-center gap-2">
                <span data-testid="text-footer-location">🇿🇦 Built in SA</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate text-center text-sm text-slate">
          <p data-testid="text-footer-copyright">&copy; {new Date().getFullYear()} Sebenza Hub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
