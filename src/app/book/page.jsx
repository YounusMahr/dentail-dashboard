'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  HeartPulse,
  Receipt,
  ShieldCheck,
  Check,
  ChevronDown,
  Sparkles,
  Building2,
  CheckCircle2,
  Activity,
  MessageSquare,
  Bot,
  Star,
  Clock,
  Lock,
  PhoneCall,
  Users,
  Stethoscope
} from 'lucide-react';
import Brand from '@/components/brand';
import ClinicImage from '@/components/clinic-image';

export default function Home() {
  const [openFaq, setOpenFaq] = useState(0);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? -1 : index);
  };

  const faqs = [
    {
      q: 'How fast can our dental clinic get started with DentalCare?',
      a: 'You can register your clinic and begin scheduling appointments in under 2 minutes. No software downloads or dedicated servers required—everything runs seamlessly in your web browser on PC, Mac, or tablet.'
    },
    {
      q: 'Can multiple dentists and reception staff use the workspace simultaneously?',
      a: 'Yes! DentalCare supports multi-user collaboration with customized roles. Receptionists can handle appointments, patient intake, and payments, while dentists can focus on treatment records, tooth charting, and clinical notes.'
    },
    {
      q: 'How does the interactive tooth charting work?',
      a: 'DentalCare provides visual odontograms for both adult (32 teeth) and pediatric (20 primary teeth) dentition. You can click on any tooth or surface (Mesial, Distal, Occlusal, Incisal) to record extractions, fillings, root canals, implants, or crowns with instant timeline logs.'
    },
    {
      q: 'Can patients receive automated WhatsApp reminders and aftercare instructions?',
      a: 'Yes! Automated appointment confirmations and 24-hour reminders can be sent straight to your patients via WhatsApp. You can also send post-procedure care tips and grant them access to their dedicated Patient Portal.'
    },
    {
      q: 'Is patient clinical and financial data secure and private?',
      a: 'Absolutely. Patient records, clinical notes, and billing history are stored with bank-grade encryption and secure access controls. Data is automatically backed up so your practice records are always safe and available.'
    },
    {
      q: 'Can I use DentalCare chairside on an iPad or touch tablet?',
      a: 'Yes! DentalCare is fully responsive and touchscreen-friendly. Many dental practitioners use an iPad or tablet right beside the dental chair to show patients their charts and dictate notes smoothly.'
    }
  ];

  return (
    <main className="marketing-home">
      <div className="container pt-0! pb-0!">
        {/* Navigation Bar */}
        <nav className="marketing-nav">
          <Link href="/book">
            <Brand />
          </Link>

          <div className="marketing-nav-links">
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
            <a href="#workflow">How It Works</a>
            <a href="#about">About</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="row">
            <Link href="/login" className="text-link mr-3">
              Staff sign in
            </Link>
            <Link href="/register-clinic" className="btn">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </nav>

        {/* Hero Section (Preserved styling & core content) */}
        <section className="marketing-hero">
          <div>
            <span className="pill">
              <HeartPulse size={13} className="mr-2" /> THOUGHTFUL CARE. CONNECTED.
            </span>
            <h1>
              Your practice.
              <br />
              Your patients.
              <br />
              <em>Perfectly in sync.</em>
            </h1>
            <p>
              Give your team a calmer day and your patients a better experience. Your
              entire dental practice, in one beautifully organised workspace.
            </p>
            <div className="row mt-7">
              <Link href="/register-clinic" className="btn">
                Create your clinic <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn secondary">
                Open workspace
              </Link>
            </div>
            <p className="text-[10px]! mt-5! flex gap-2 items-center text-slate-500">
              <ShieldCheck size={15} className="text-emerald-600" /> Built around the way dental teams work
            </p>
          </div>

          <div className="marketing-photo">
            <ClinicImage />
            <div className="photo-note">
              <HeartPulse size={28} />
              <div>
                <strong>More time for healthy smiles.</strong>
                <small className="block text-[9px] text-slate-400 mt-1">
                  A little less admin. A little more care.
                </small>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Performance Statistics Strip */}
        <section className="marketing-stats-strip">
          <div className="marketing-stat-item">
            <div className="marketing-stat-icon">
              <Building2 size={22} />
            </div>
            <div>
              <div className="marketing-stat-number">250+</div>
              <div className="marketing-stat-label">Active Dental Clinics</div>
            </div>
          </div>

          <div className="marketing-stat-item">
            <div className="marketing-stat-icon">
              <CalendarCheck2 size={22} />
            </div>
            <div>
              <div className="marketing-stat-number">99.4%</div>
              <div className="marketing-stat-label">Appointment Show-up Rate</div>
            </div>
          </div>

          <div className="marketing-stat-item">
            <div className="marketing-stat-icon">
              <Activity size={22} />
            </div>
            <div>
              <div className="marketing-stat-number">40,000+</div>
              <div className="marketing-stat-label">Digital Patient Charts</div>
            </div>
          </div>

          <div className="marketing-stat-item">
            <div className="marketing-stat-icon">
              <Star size={22} />
            </div>
            <div>
              <div className="marketing-stat-number">4.9 / 5</div>
              <div className="marketing-stat-label">Rated by Dental Teams</div>
            </div>
          </div>
        </section>

        {/* Features Grid Section */}
        <section id="features" className="scroll-mt-10">
          <div className="marketing-section-header">
            <span className="pill">
              <Sparkles size={12} className="mr-1.5" /> ALL-IN-ONE WORKSPACE
            </span>
            <h2>Everything your dental clinic needs, unified</h2>
            <p>
              Replace disconnected paper files and clunky legacy software with one fast, intuitive, and secure clinic operating system.
            </p>
          </div>

          <div className="marketing-features-grid">
            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <CalendarCheck2 size={22} />
              </span>
              <h3>A smoother patient journey</h3>
              <p>
                From online bookings to multi-chair schedules and rapid check-ins, keep every appointment organized without double-booking.
              </p>
            </div>

            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <HeartPulse size={22} />
              </span>
              <h3>A complete picture of care</h3>
              <p>
                Patient clinical histories, doctor consultation notes, digital consent forms, and document uploads right where you need them.
              </p>
            </div>

            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <Receipt size={22} />
              </span>
              <h3>A clearer view of your practice</h3>
              <p>
                Manage itemized invoices, record cash or card payments, and understand outstanding balances and daily chair collections.
              </p>
            </div>

            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <Activity size={22} />
              </span>
              <h3>Interactive Dental Charting</h3>
              <p>
                Full adult (32) and child (20) visual odontograms. Log restorations, extractions, root canals, and tooth-by-tooth histories in seconds.
              </p>
            </div>

            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <MessageSquare size={22} />
              </span>
              <h3>Automated WhatsApp Recalls</h3>
              <p>
                Send automatic appointment reminders, follow-up recalls, and post-procedure aftercare instructions straight to patients' phones.
              </p>
            </div>

            <div className="marketing-feature-card">
              <span className="metric-icon mint">
                <Bot size={22} />
              </span>
              <h3>AI Assistant & Voice Drafts</h3>
              <p>
                Dictate chairside consultation notes in English or Urdu. The smart clinical assistant formats structured summaries in real time.
              </p>
            </div>
          </div>
        </section>

        {/* Detailed Benefits Section */}
        <section id="benefits" className="scroll-mt-10">
          <div className="marketing-section-header">
            <span className="pill">
              <HeartPulse size={12} className="mr-1.5" /> CLINICAL EXCELLENCE
            </span>
            <h2>Why modern practices switch to DentalCare</h2>
            <p>
              Designed alongside practicing dentists to eliminate friction, reduce chair idle time, and deliver a relaxing patient experience.
            </p>
          </div>

          <div className="marketing-benefits-wrap">
            {/* Benefit Row 1: 1st = image right, text left */}
            <div className="marketing-benefit-row">
              <div className="marketing-benefit-copy">
                <span className="pill">
                  <Activity size={12} className="mr-1.5" /> CHAIRSIDE CHARTING
                </span>
                <h3>Visual odontograms that tell the complete clinical story</h3>
                <p>
                  No more deciphering handwritten notes or flipping through old paper folders. DentalCare gives dentists an interactive, anatomical tooth chart that updates instantly as you treat.
                </p>
                <ul className="marketing-checklist">
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>One-click surface selection for Mesial, Distal, Occlusal, Incisal, and Cervical surfaces.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Seamless switching between adult permanent dentition and pediatric primary teeth.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Chronological procedure history for every individual tooth at a single glance.</span>
                  </li>
                </ul>
                <Link href="/register-clinic" className="text-link">
                  See how charting works <ArrowRight size={14} />
                </Link>
              </div>

              <div className="marketing-benefit-media">
                <img
                  src="/images/benefit-charting.jpg"
                  alt="Modern dental clinic examination room"
                />
                <div className="marketing-benefit-floating-pill">
                  <Activity size={18} className="text-emerald-600" />
                  <span>32-Tooth Interactive Odontogram Live</span>
                </div>
              </div>
            </div>

            {/* Benefit Row 2: 2nd = image left, text right */}
            <div className="marketing-benefit-row">
              <div className="marketing-benefit-media">
                <img
                  src="/images/benefit-whatsapp.jpg"
                  alt="Dentist consulting smiling patient"
                />
                <div className="marketing-benefit-floating-pill">
                  <MessageSquare size={18} className="text-emerald-600" />
                  <span>WhatsApp Alerts: 98% Open Rate</span>
                </div>
              </div>

              <div className="marketing-benefit-copy">
                <span className="pill">
                  <MessageSquare size={12} className="mr-1.5" /> PATIENT ENGAGEMENT
                </span>
                <h3>Cut missed appointments in half with WhatsApp automation</h3>
                <p>
                  Patients often miss phone calls and ignore generic emails. With automated WhatsApp messaging, your clinic sends polite confirmations and reminder alerts directly to their hands.
                </p>
                <ul className="marketing-checklist">
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Automatic 24-hour and 2-hour appointment reminders sent without manual effort.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Post-op instructions automatically shared after tooth extractions, implants, or fillings.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Patients can view their scheduled appointments via the self-service Patient Portal.</span>
                  </li>
                </ul>
                <Link href="/register-clinic" className="text-link">
                  Explore patient communications <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Benefit Row 3: 3rd = image right, text left */}
            <div className="marketing-benefit-row">
              <div className="marketing-benefit-copy">
                <span className="pill">
                  <Receipt size={12} className="mr-1.5" /> FINANCIAL VISIBILITY
                </span>
                <h3>Transparent billing, chair collections, and instant invoices</h3>
                <p>
                  Keep your clinic's finances in perfect health. Generate clean, itemized invoices in seconds, record split payments, and see how each doctor chair is performing day by day.
                </p>
                <ul className="marketing-checklist">
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Itemized procedure pricing, automatic discounts, and tax calculations.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Track pending balances, partial deposits, and multi-stage treatment payments.</span>
                  </li>
                  <li>
                    <span className="marketing-checklist-icon">
                      <Check size={14} />
                    </span>
                    <span>Download or print professional invoices with your clinic's custom branding.</span>
                  </li>
                </ul>
                <Link href="/register-clinic" className="text-link">
                  Discover billing features <ArrowRight size={14} />
                </Link>
              </div>

              <div className="marketing-benefit-media">
                <img
                  src="/images/benefit-billing.jpg"
                  alt="Modern precision dental equipment"
                />
                <div className="marketing-benefit-floating-pill">
                  <Receipt size={18} className="text-emerald-600" />
                  <span>Daily Chair Revenue: 100% Accounted</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="workflow" className="scroll-mt-10">
          <div className="marketing-section-header">
            <span className="pill">
              <Clock size={12} className="mr-1.5" /> HOW IT WORKS
            </span>
            <h2>Up and running in 4 simple steps</h2>
            <p>
              No lengthy onboarding seminars or complex IT configurations. Your staff can be trained and working in under 15 minutes.
            </p>
          </div>

          <div className="marketing-steps-grid">
            <div className="marketing-step-card">
              <span className="marketing-step-number">01</span>
              <h3>Register Your Clinic</h3>
              <p>
                Create your clinic account, configure operational hours, and setup your doctor chairs in two minutes.
              </p>
            </div>

            <div className="marketing-step-card">
              <span className="marketing-step-number">02</span>
              <h3>Schedule Appointments</h3>
              <p>
                Book incoming patients, assign designated chairs, and automatically trigger WhatsApp confirmation messages.
              </p>
            </div>

            <div className="marketing-step-card">
              <span className="marketing-step-number">03</span>
              <h3>Chart & Consult Digitally</h3>
              <p>
                Use the visual tooth chart chairside, record clinical notes, and draft prescription treatments seamlessly.
              </p>
            </div>

            <div className="marketing-step-card">
              <span className="marketing-step-number">04</span>
              <h3>Invoice & Follow Up</h3>
              <p>
                Issue clear itemized bills with one click and set automated recall reminders for patient follow-up checks.
              </p>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="scroll-mt-10">
          <div className="marketing-about">
            <div className="marketing-about-copy">
              <span className="pill">
                <Stethoscope size={12} className="mr-1.5" /> ABOUT DENTALCARE
              </span>
              <h2>Crafted for dental teams who value calm, precision, and care</h2>
              <p>
                Dental practices are fast-paced healthcare environments where doctor focus and patient comfort matter most. Traditional dental management systems are slow, confusing, and cluttered.
              </p>
              <p>
                We built DentalCare to bring calm back to your clinic. By unifying bookings, dental charting, invoicing, and patient communication into one clean interface, your team spends less time wrestling software and more time crafting healthy smiles.
              </p>

              <div className="marketing-pillars">
                <div className="marketing-pillar-item">
                  <div className="marketing-pillar-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <strong>Healthcare-Grade Privacy & Security</strong>
                    <p>All patient records, medical histories, and clinic financials are encrypted with continuous backups.</p>
                  </div>
                </div>

                <div className="marketing-pillar-item">
                  <div className="marketing-pillar-icon">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <strong>Zero-Friction Design</strong>
                    <p>Intuitive user experience that dentists, hygienists, and reception staff master without extensive manuals.</p>
                  </div>
                </div>

                <div className="marketing-pillar-item">
                  <div className="marketing-pillar-icon">
                    <Users size={20} />
                  </div>
                  <div>
                    <strong>Complete Multi-Chair Collaboration</strong>
                    <p>Seamless real-time synchronization between the front reception desk and back dental operatories.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="marketing-about-photo">
              <img
                src="/images/about-team.jpg"
                alt="Professional dental team in modern clinic"
              />
              <div className="marketing-about-quote-box">
                <strong>"A little less admin. A little more care."</strong>
                <p className="mt-1! text-[10px] text-slate-500">
                  Our commitment to dental teams worldwide.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials / Social Proof */}
        <section id="testimonials" className="scroll-mt-10">
          <div className="marketing-section-header">
            <span className="pill">
              <Star size={12} className="mr-1.5 text-amber-500" /> CLINICIAN REVIEWS
            </span>
            <h2>Loved by clinics, trusted by dental surgeons</h2>
            <p>
              Discover how leading dental practitioners across various specialties use DentalCare every single day.
            </p>
          </div>

          <div className="marketing-testimonials-grid">
            <div className="marketing-testimonial-card">
              <div>
                <div className="marketing-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#e8a735" color="#e8a735" />
                  ))}
                </div>
                <p className="marketing-testimonial-quote">
                  "DentalCare completely changed our daily clinic rhythm. Our reception staff saves over 2 hours every day, and our patients love receiving appointment details directly on WhatsApp."
                </p>
              </div>
              <div className="marketing-testimonial-author">
                <img
                  src="/images/doctor-ayesha.jpg"
                  alt="Dr. Ayesha Khan"
                  className="marketing-author-avatar"
                />
                <div className="marketing-author-info">
                  <strong>Dr. Ayesha Khan</strong>
                  <small>Lead Dentist · SmileCraft Aesthetics</small>
                </div>
              </div>
            </div>

            <div className="marketing-testimonial-card">
              <div>
                <div className="marketing-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#e8a735" color="#e8a735" />
                  ))}
                </div>
                <p className="marketing-testimonial-quote">
                  "The interactive tooth charting is blazing fast. Reviewing past treatments right next to the dental chair on my tablet makes consultations smoother and inspires real patient trust."
                </p>
              </div>
              <div className="marketing-testimonial-author">
                <img
                  src="/images/doctor-tariq.jpg"
                  alt="Dr. Tariq Malik"
                  className="marketing-author-avatar"
                />
                <div className="marketing-author-info">
                  <strong>Dr. Tariq Malik</strong>
                  <small>Consultant Surgeon · City Dental Hospital</small>
                </div>
              </div>
            </div>

            <div className="marketing-testimonial-card">
              <div>
                <div className="marketing-stars">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={15} fill="#e8a735" color="#e8a735" />
                  ))}
                </div>
                <p className="marketing-testimonial-quote">
                  "Finally, dental software that feels like it belongs in 2026. Financial reporting across our 4 operatories is crystal clear, and new dental assistants learn it in 15 minutes."
                </p>
              </div>
              <div className="marketing-testimonial-author">
                <img
                  src="/images/doctor-sarah.jpg"
                  alt="Dr. Sarah Jenkins"
                  className="marketing-author-avatar"
                />
                <div className="marketing-author-info">
                  <strong>Dr. Sarah Jenkins</strong>
                  <small>Practice Director · Apex Dental Group</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive FAQ Section */}
        <section id="faq" className="scroll-mt-10">
          <div className="marketing-section-header">
            <span className="pill">
              <CheckCircle2 size={12} className="mr-1.5" /> FREQUENTLY ASKED
            </span>
            <h2>Got questions? We have answers.</h2>
            <p>
              Everything you need to know about setting up DentalCare and managing your practice.
            </p>
          </div>

          <div className="marketing-faq-list">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`marketing-faq-card ${openFaq === index ? 'open' : ''}`}
              >
                <button
                  type="button"
                  className="marketing-faq-trigger"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{faq.q}</span>
                  <ChevronDown size={18} className="marketing-faq-icon" />
                </button>
                {openFaq === index && (
                  <div className="marketing-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* High-Converting CTA Banner */}
        <section className="marketing-cta">
          <span className="pill">
            <Sparkles size={12} className="mr-1.5" /> TRANSFORM YOUR CLINIC TODAY
          </span>
          <h2>Ready to elevate your dental practice?</h2>
          <p>
            Join 250+ dental clinics delivering calmer workdays, stress-free administration, and unforgettable patient smiles.
          </p>
          <div className="marketing-cta-buttons">
            <Link href="/register-clinic" className="btn">
              Create your clinic now <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn secondary">
              Staff sign in
            </Link>
          </div>

          <div className="marketing-cta-badges">
            <span>
              <Check size={14} className="text-emerald-300" /> Free practice trial
            </span>
            <span>
              <Check size={14} className="text-emerald-300" /> Instant 2-minute setup
            </span>
            <span>
              <Check size={14} className="text-emerald-300" /> Bank-grade data encryption
            </span>
          </div>
        </section>

        {/* Professional Multi-Column Footer */}
        <footer className="marketing-footer">
          <div className="marketing-footer-grid">
            <div className="marketing-footer-brand">
              <Brand />
              <p>
                Thoughtful clinic management software built to empower modern dental practices with streamlined scheduling, visual charting, and automated patient care.
              </p>
              <div className="flex gap-2 items-center text-[11px] text-emerald-800 font-medium">
                <ShieldCheck size={15} /> HIPAA-Ready & Encrypted
              </div>
            </div>

            <div className="marketing-footer-col">
              <h4>Clinical Modules</h4>
              <ul className="marketing-footer-links">
                <li><a href="#features">Smart Scheduling</a></li>
                <li><a href="#features">Interactive Odontogram</a></li>
                <li><a href="#features">WhatsApp Reminders</a></li>
                <li><a href="#features">Itemized Invoicing</a></li>
                <li><a href="#features">AI Clinical Notes</a></li>
                <li><Link href="/login">Patient Portal</Link></li>
              </ul>
            </div>

            <div className="marketing-footer-col">
              <h4>Practice Hub</h4>
              <ul className="marketing-footer-links">
                <li><a href="#about">About DentalCare</a></li>
                <li><a href="#benefits">Practice Benefits</a></li>
                <li><a href="#workflow">Clinic Workflow</a></li>
                <li><a href="#testimonials">Doctor Reviews</a></li>
                <li><a href="#faq">Help & FAQ</a></li>
                <li><Link href="/register-clinic">Clinic Registration</Link></li>
              </ul>
            </div>

            <div className="marketing-footer-col">
              <h4>Clinic Support</h4>
              <ul className="marketing-footer-links">
                <li><span className="text-[12px] text-slate-500">Mon - Sat: 9:00 AM - 8:00 PM</span></li>
                <li><span className="text-[12px] text-slate-500">Fast Response via WhatsApp & Email</span></li>
                <li><Link href="/login" className="text-emerald-700 font-medium">Staff Workspace Login →</Link></li>
                <li><Link href="/register-clinic" className="text-emerald-700 font-medium">Register New Clinic →</Link></li>
              </ul>
            </div>
          </div>

          <div className="marketing-footer-bottom">
            <span>
              © {new Date().getFullYear()} DentalCare Clinic Management. Thoughtful care, perfectly connected.
            </span>
            <span>
              Clinic photography courtesy of Unsplash · Designed for dental professionals
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
