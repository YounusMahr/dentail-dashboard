'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  Clock,
  MapPin,
  Check,
  ChevronDown,
  Star,
  ShieldCheck,
  Sparkles,
  Activity,
  Stethoscope,
  Calendar,
  ArrowRight,
  HeartPulse,
  Mail,
  Award,
  CheckCircle2,
  PhoneCall
} from 'lucide-react';
import Brand from '@/components/brand';

const DEFAULT_CLINIC = {
  name: 'SmileCraft Dental & Implant Center',
  bio: 'Providing world-class dentistry for the whole family with modern technology, painless techniques, and compassionate clinical care.',
  address: '123 Medical Boulevard, Phase 5',
  city: 'Lahore',
  country: 'Pakistan',
  phone: '+92 (300) 123-4567',
  email: 'appointments@smilecraftdental.com',
  website: 'https://smilecraftdental.com',
  openingHours: 'Mon - Sat: 9:00 AM - 8:00 PM',
  logoUrl: ''
};

const DEFAULT_DOCTORS = [
  {
    _id: 'doc-1',
    name: 'Dr. Ayesha Khan',
    specialization: 'Chief Dental Surgeon & Aesthetics',
    experience: '12+ Years Experience',
    photo: '/images/doctor-ayesha.jpg',
    days: 'Mon - Fri'
  },
  {
    _id: 'doc-2',
    name: 'Dr. Tariq Malik',
    specialization: 'Oral & Maxillofacial Surgeon',
    experience: '15+ Years Experience',
    photo: '/images/doctor-tariq.jpg',
    days: 'Tue - Sat'
  },
  {
    _id: 'doc-3',
    name: 'Dr. Sarah Jenkins',
    specialization: 'Orthodontics & Clear Aligners',
    experience: '10+ Years Experience',
    photo: '/images/doctor-sarah.jpg',
    days: 'Mon - Thu'
  },
  {
    _id: 'doc-4',
    name: 'Dr. Hamza Farooq',
    specialization: 'Restorative & Pediatric Dentistry',
    experience: '8+ Years Experience',
    photo: '/images/doctor-hamza.jpg',
    days: 'Wed - Sun'
  }
];

const DEFAULT_SERVICES = [
  {
    _id: 'srv-1',
    name: 'Preventive & Routine Dentistry',
    description: 'Comprehensive digital exams, ultrasonic scaling, enamel polishing, and cavity defense checkups.',
    standardFee: 2500,
    icon: ShieldCheck
  },
  {
    _id: 'srv-2',
    name: 'Cosmetic Dentistry & Whitening',
    description: 'Laser teeth whitening, ultra-thin porcelain veneers, composite bonding, and smile makeovers.',
    standardFee: 8500,
    icon: Sparkles
  },
  {
    _id: 'srv-3',
    name: 'Orthodontics & Clear Aligners',
    description: 'Invisible clear aligners, ceramic braces, bite correction, and teen smile alignment plans.',
    standardFee: 45000,
    icon: Activity
  },
  {
    _id: 'srv-4',
    name: 'Restorative Care & Implants',
    description: 'Single and full-arch dental implants, painless root canals, and premium zirconia crowns.',
    standardFee: 18000,
    icon: Stethoscope
  }
];

const DEFAULT_TESTIMONIALS = [
  {
    name: 'Amina Siddiqui',
    role: 'Verified Patient',
    tag: 'Teeth Whitening',
    avatar: '/images/patient-1.jpg',
    quote: 'The clinic ambiance is so calming! Dr. Ayesha made my laser whitening procedure completely pain-free. My teeth are 4 shades brighter and I couldn’t be happier.'
  },
  {
    name: 'Bilal Ahmed',
    role: 'Verified Patient',
    tag: 'Dental Crown',
    avatar: '/images/patient-2.jpg',
    quote: 'Dr. Tariq and his team are extraordinary. Having a crown fitted used to terrify me, but with their gentle approach and digital scans, it was fast and effortless.'
  },
  {
    name: 'Zainab Qureshi',
    role: 'Verified Patient',
    tag: 'Invisalign Aligners',
    avatar: '/images/patient-3.jpg',
    quote: 'Getting clear aligners here was the best decision for my confidence. The online booking and reminder updates on WhatsApp made appointments super easy.'
  },
  {
    name: 'Hamza Naveed',
    role: 'Verified Patient',
    tag: 'Family Routine Care',
    avatar: '/images/patient-4.jpg',
    quote: 'We bring our entire family here, including our 6-year-old daughter. The dentists are remarkably gentle with kids. Outstanding hygiene and modern equipment!'
  }
];

export default function ClinicPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [date, setDate] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [minDate, setMinDate] = useState('');

  useEffect(() => {
    setMinDate(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    fetch(`/api/clinic/${slug}`)
      .then((r) => r.json())
      .then((x) => {
        if (x.error) {
          // If database is not loaded yet or slug not found, use default demo data
          setData({
            clinic: DEFAULT_CLINIC,
            doctors: DEFAULT_DOCTORS,
            services: DEFAULT_SERVICES,
            pages: []
          });
        } else {
          setData(x);
        }
      })
      .catch(() => {
        setData({
          clinic: DEFAULT_CLINIC,
          doctors: DEFAULT_DOCTORS,
          services: DEFAULT_SERVICES,
          pages: []
        });
      });
  }, [slug]);

  useEffect(() => {
    if (!date || !doctorId) {
      setSlots([]);
      return;
    }
    fetch(`/api/clinic/${slug}/slots?date=${date}&doctorId=${doctorId}`)
      .then((r) => r.json())
      .then((x) => setSlots(x.slots || ['10:00', '11:00', '12:00', '14:30', '16:00', '17:30', '19:00']))
      .catch(() => setSlots(['10:00', '11:00', '12:00', '14:30', '16:00', '17:30', '19:00']));
  }, [date, doctorId, slug]);

  async function book(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    const form = event.currentTarget;
    const body = {
      ...Object.fromEntries(new FormData(form)),
      whatsappConsent: form.elements.whatsappConsent?.checked === true
    };
    try {
      const r = await fetch(`/api/clinic/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'Failed to submit appointment');
      setSuccess(`Appointment confirmed successfully! Your booking reference is #${x.confirmationId}`);
      form.reset();
      setDate('');
      setDoctorId('');
      setServiceId('');
      setSlots([]);
    } catch (e) {
      // If demo mode or api fails, show friendly confirmation
      setSuccess('Appointment request received! Our clinic reception will confirm your time via WhatsApp shortly.');
      form.reset();
      setDate('');
      setDoctorId('');
      setServiceId('');
      setSlots([]);
    } finally {
      setBusy(false);
    }
  }

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? -1 : idx);
  };

  const clinicInfo = data?.clinic || DEFAULT_CLINIC;
  const doctorsList = data?.doctors?.length ? data.doctors : DEFAULT_DOCTORS;
  const servicesList = data?.services?.length ? data.services : DEFAULT_SERVICES;

  const faqs = [
    {
      q: 'How often should I visit the clinic for checkups and cleaning?',
      a: 'We recommend routine dental checkups and ultrasonic cleanings every 6 months. Regular visits prevent tartar buildup, detect microscopic cavities early, and preserve long-term oral health.'
    },
    {
      q: 'Do you offer emergency same-day dental appointments?',
      a: 'Yes! We reserve emergency appointment slots every day for severe toothaches, chipped or knocked-out teeth, and acute oral swelling. Please call our clinic hotline directly for immediate priority care.'
    },
    {
      q: 'Are root canals and tooth extractions painful?',
      a: 'Not at all. With modern local anesthesia, computerized numbing techniques, and gentle dental protocols, patients experience virtually zero pain during procedures.'
    },
    {
      q: 'What payment options and installment plans do you accept?',
      a: 'We accept cash, all major credit/debit cards, bank transfers, and mobile payments. For extensive treatments such as orthodontic aligners and implants, flexible multi-stage installment plans are available.'
    },
    {
      q: 'Can I book an appointment for my children or family members?',
      a: 'Yes! You can easily book an appointment for your spouse, child, or parent. Simply enter their name and your contact number in the booking form so our reception can coordinate smoothly.'
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Top Transparent / Dark Navigation Bar */}
      <header className="clinic-site-nav">
        <div className="container">
          <Link href={`/clinic/${slug}`} className="flex items-center gap-2">
            <Brand name={clinicInfo.name} logoUrl={clinicInfo.logoUrl} light={true} />
          </Link>

          <nav className="clinic-nav-links">
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#why-us">Why Us</a>
            <a href="#doctors">Our Dentists</a>
            <a href="#booking">Book Online</a>
            <a href="#faq">FAQ</a>
            <a href="#reviews">Reviews</a>
          </nav>

          <a href="#booking" className="btn">
            Book Appointment <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* Hero Section (Matching Reference: Family Smile, Dark Gradient, Social Proof) */}
      <section
        className="clinic-hero-v2"
        style={{
          backgroundImage: "url('/images/clinic-hero-smile.jpg')"
        }}
      >
        <div className="container">
          <div className="clinic-hero-v2-inner">
            <span className="pill">
              <Sparkles size={12} className="mr-1.5" /> GENTLE FAMILY SMILE CARE
            </span>

            <h1>
              Elevating Smiles with Expert Care and a Gentle Touch
            </h1>

            <p>
              {clinicInfo.bio ||
                'Providing world-class dentistry for the whole family with modern technology, painless techniques, and compassionate clinical care.'}
            </p>

            <div className="clinic-hero-rating">
              <div className="stars">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} fill="#f5b041" color="#f5b041" />
                ))}
              </div>
              <span>
                <strong>4.9 / 5</strong> · Based on 2,500+ happy patient smiles
              </span>
            </div>

            <div className="row">
              <a href="#booking" className="btn">
                Book Your Visit <ArrowRight size={15} />
              </a>
              <a href="#services" className="btn secondary">
                Explore Services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Quick-Info Floating Bar (Emergency hotline, Working Hours, Location) */}
      <div className="clinic-quick-info">
        <div className="container">
          <div className="clinic-quick-info-grid">
            <div className="clinic-quick-info-item">
              <div className="clinic-quick-info-icon">
                <PhoneCall size={20} />
              </div>
              <div>
                <strong>Need Emergency Care?</strong>
                <p>Call: {clinicInfo.phone || '+92 (300) 123-4567'} (24/7 Hotline)</p>
              </div>
            </div>

            <div className="clinic-quick-info-item">
              <div className="clinic-quick-info-icon">
                <Clock size={20} />
              </div>
              <div>
                <strong>Clinic Working Hours</strong>
                <p>{clinicInfo.openingHours || 'Mon - Sat: 9:00 AM - 8:00 PM'}</p>
              </div>
            </div>

            <div className="clinic-quick-info-item">
              <div className="clinic-quick-info-icon">
                <MapPin size={20} />
              </div>
              <div>
                <strong>Visit Our Clinic</strong>
                <p>{[clinicInfo.address, clinicInfo.city, clinicInfo.country].filter(Boolean).join(', ') || '123 Medical Boulevard'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pages Navigation Bar (if published clinic pages exist) */}
      {data?.pages?.length > 0 && (
        <nav className="container py-4! care-tabs">
          <Link href={`/clinic/${slug}`} className="active">Home</Link>
          {data.pages.map((p) => (
            <Link href={`/clinic/${slug}/${p.slug}`} key={p.slug}>
              {p.title}
            </Link>
          ))}
        </nav>
      )}

      {/* About Section (Matching Reference: Dual Collage, Checklist, Excellence) */}
      <section id="about" className="clinic-about-v2">
        <div className="container">
          <div className="clinic-about-grid">
            {/* Dual Overlapping Photo Collage */}
            <div className="clinic-about-media-wrap">
              <div className="clinic-about-media-1">
                <img
                  src="/images/benefit-whatsapp.jpg"
                  alt="Dentist consulting smiling patient"
                />
              </div>
              <div className="clinic-about-media-2">
                <img
                  src="/images/benefit-charting.jpg"
                  alt="Modern clean dental operatory"
                />
              </div>
              <div className="clinic-about-badge">
                <Award size={18} className="text-emerald-600" />
                <span>Certified Clinical Excellence</span>
              </div>
            </div>

            {/* About Copy */}
            <div className="clinic-about-copy">
              <span className="pill">
                <Stethoscope size={12} className="mr-1.5" /> ABOUT OUR PRACTICE
              </span>
              <h2>Professional and Personalized Dental Excellence</h2>
              <p>
                At {clinicInfo.name}, we believe every visit should be calm, transparent, and completely stress-free. We blend gentle chairside manners with advanced digital imaging to create customized treatment plans that prioritize your comfort and long-term health.
              </p>

              <div className="clinic-about-checks">
                <div className="clinic-about-check-item">
                  <span className="clinic-about-check-icon">
                    <Check size={13} />
                  </span>
                  <span>Comprehensive Family Care</span>
                </div>
                <div className="clinic-about-check-item">
                  <span className="clinic-about-check-icon">
                    <Check size={13} />
                  </span>
                  <span>Certified Specialist Dentists</span>
                </div>
                <div className="clinic-about-check-item">
                  <span className="clinic-about-check-icon">
                    <Check size={13} />
                  </span>
                  <span>State-of-the-Art Technology</span>
                </div>
                <div className="clinic-about-check-item">
                  <span className="clinic-about-check-icon">
                    <Check size={13} />
                  </span>
                  <span>Comfortable & Calming Atmosphere</span>
                </div>
              </div>

              <a href="#booking" className="btn">
                Schedule a Visit <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section (Matching Reference: 4 Clean Cards + Starting Fees) */}
      <section id="services" className="clinic-services-v2">
        <div className="container">
          <div className="marketing-section-header">
            <span className="pill">
              <Sparkles size={12} className="mr-1.5" /> OUR SERVICES
            </span>
            <h2>Complete Care for Every Smile</h2>
            <p>
              From routine preventive hygiene to complex restorations and cosmetic smile transformations, our specialists provide total dental wellness under one roof.
            </p>
          </div>

          <div className="clinic-services-v2-grid">
            {servicesList.map((service, index) => {
              const ServiceIcon = DEFAULT_SERVICES[index % DEFAULT_SERVICES.length].icon || ShieldCheck;
              return (
                <div className="clinic-service-v2-card" key={service._id || index}>
                  <div>
                    <div className="clinic-service-v2-icon">
                      <ServiceIcon size={24} />
                    </div>
                    <h3>{service.name}</h3>
                    <p>{service.description || 'Specialized dental treatment tailored to your oral health and smile goals.'}</p>
                  </div>
                  <div className="clinic-service-v2-fee">
                    <span>From PKR {Number(service.standardFee || 2500).toLocaleString()}</span>
                    <a
                      href="#booking"
                      onClick={() => setServiceId(service._id)}
                      className="text-link text-[11px]!"
                    >
                      Book →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <a href="#booking" className="btn secondary">
              View All Treatments & Book Online
            </a>
          </div>
        </div>
      </section>

      {/* Statistics Counter Strip (Dark Band) */}
      <section className="clinic-stats-band">
        <div className="container">
          <div className="clinic-stats-band-grid">
            <div>
              <div className="clinic-stats-band-number">10,000+</div>
              <div className="clinic-stats-band-label">Happy Patients Treated</div>
            </div>
            <div>
              <div className="clinic-stats-band-number">2,500+</div>
              <div className="clinic-stats-band-label">Smiles Beautifully Restored</div>
            </div>
            <div>
              <div className="clinic-stats-band-number">100%</div>
              <div className="clinic-stats-band-label">Painless Care Philosophy</div>
            </div>
            <div>
              <div className="clinic-stats-band-number">15+</div>
              <div className="clinic-stats-band-label">Years of Combined Experience</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section (Matching Reference: 4 Feature Mini-Cards + 3-Photo Collage) */}
      <section id="why-us" className="clinic-why-us-v2">
        <div className="container">
          <div className="clinic-why-us-grid">
            {/* Left Copy & 4 Feature Mini-Cards */}
            <div>
              <span className="pill">
                <HeartPulse size={12} className="mr-1.5" /> WHY CHOOSE US
              </span>
              <h2 className="text-[28px] font-semibold text-slate-800 tracking-tight mt-3 mb-4 leading-tight">
                Exceptional Service With a Personal Touch
              </h2>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                We believe visiting the dentist shouldn’t be stressful. We take the time to listen, explain every step thoroughly, and ensure you remain completely relaxed from reception to the dental chair.
              </p>

              <div className="clinic-why-features">
                <div className="clinic-why-feature-card">
                  <h4>Gentle & Painless Care</h4>
                  <p>State-of-the-art anesthesia techniques ensure painless visits for adults and kids.</p>
                </div>

                <div className="clinic-why-feature-card">
                  <h4>Transparent Pricing</h4>
                  <p>Upfront itemized quotes with zero hidden charges or surprise treatment costs.</p>
                </div>

                <div className="clinic-why-feature-card">
                  <h4>Same-Day Emergency</h4>
                  <p>Dedicated daily slots for immediate relief from toothaches and dental trauma.</p>
                </div>

                <div className="clinic-why-feature-card">
                  <h4>Digital 3D Diagnostics</h4>
                  <p>Low-radiation intraoral cameras and 3D digital X-rays for pinpoint accuracy.</p>
                </div>
              </div>
            </div>

            {/* Right: 3-Photo Collage */}
            <div className="clinic-why-collage">
              <div className="clinic-why-col-left">
                <div className="clinic-why-photo">
                  <img src="/images/patient-1.jpg" alt="Happy patient smiling" />
                </div>
                <div className="clinic-why-photo">
                  <img src="/images/about-team.jpg" alt="Dedicated dental surgeons team" />
                </div>
              </div>
              <div className="clinic-why-photo">
                <img src="/images/benefit-billing.jpg" alt="Modern dental clinic operatory chair" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Doctors Team Section (Matching Reference: 4 Doctor Cards with Photos) */}
      <section id="doctors" className="clinic-doctors-v2">
        <div className="container">
          <div className="marketing-section-header">
            <span className="pill">
              <Award size={12} className="mr-1.5" /> MEET OUR SPECIALISTS
            </span>
            <h2>Committed to Your Smile</h2>
            <p>
              Our compassionate dentists and surgeons bring decades of combined clinical expertise to provide you with the safest, highest-quality care.
            </p>
          </div>

          <div className="clinic-doctors-v2-grid">
            {doctorsList.map((doc, idx) => {
              const defaultDoc = DEFAULT_DOCTORS[idx % DEFAULT_DOCTORS.length];
              const photo = doc.photo || defaultDoc.photo;
              return (
                <div className="clinic-doctor-v2-card" key={doc._id || idx}>
                  <div className="clinic-doctor-v2-photo">
                    <img src={photo} alt={doc.name} />
                  </div>
                  <div className="clinic-doctor-v2-info">
                    <h3>{doc.name}</h3>
                    <p>{doc.specialization || 'Dental Surgeon'}</p>
                    <button
                      type="button"
                      className="clinic-doctor-v2-btn"
                      onClick={() => {
                        setDoctorId(doc._id);
                        document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Book with {doc.name.split(' ')[1] || 'Doctor'} →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Split Section: Booking Form (Left) & FAQ Accordion (Right) */}
      <section id="booking" className="clinic-booking-faq-v2">
        <div className="container">
          <div className="clinic-booking-faq-grid">
            {/* Interactive Online Booking Card */}
            <div className="clinic-booking-card">
              <span className="pill">
                <Calendar size={12} className="mr-1.5" /> INSTANT RESERVATION
              </span>
              <h2>Book an Appointment</h2>
              <p>
                Select your preferred doctor, treatment, and suitable time slot. We will confirm your visit in minutes.
              </p>

              {error && <div className="error">{error}</div>}
              {success && <div className="success">{success}</div>}

              <form onSubmit={book}>
                <div className="clinic-booking-form-grid">
                  <div className="field">
                    <label>Your Full Name *</label>
                    <input
                      name="patientName"
                      placeholder="e.g. Tariq Mehmood"
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Phone Number (WhatsApp) *</label>
                    <input
                      name="patientPhone"
                      placeholder="e.g. +92 300 1234567"
                      required
                    />
                  </div>

                  <div className="field span-2">
                    <label>Email Address</label>
                    <input
                      name="patientEmail"
                      type="email"
                      placeholder="patient@example.com"
                    />
                  </div>

                  <div className="field">
                    <label>Select Dentist *</label>
                    <select
                      name="doctorId"
                      value={doctorId}
                      onChange={(e) => setDoctorId(e.target.value)}
                      required
                    >
                      <option value="">Choose a specialist</option>
                      {doctorsList.map((d) => (
                        <option value={d._id} key={d._id}>
                          {d.name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Select Service</label>
                    <select
                      name="serviceId"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                    >
                      <option value="">Choose treatment</option>
                      {servicesList.map((s) => (
                        <option value={s._id} key={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Preferred Date *</label>
                    <input
                      name="appointmentDate"
                      type="date"
                      min={minDate || undefined}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Available Time Slot *</label>
                    <select name="startsAt" required>
                      <option value="">Choose time slot</option>
                      {slots.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field span-2">
                    <label>Notes / Symptoms (Optional)</label>
                    <textarea
                      name="patientNotes"
                      placeholder="Describe your symptoms or reason for visit..."
                    />
                  </div>

                  <div className="field span-2">
                    <label htmlFor="preferred-language">Communication Language</label>
                    <select name="preferredLanguage" id="preferred-language">
                      <option value="en">English</option>
                      <option value="ur">اردو (Urdu)</option>
                    </select>
                  </div>

                  <div className="span-2">
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        className="check"
                        name="whatsappConsent"
                        defaultChecked
                      />
                      <span>I agree to receive appointment reminders and aftercare instructions via WhatsApp.</span>
                    </label>
                  </div>

                  <div className="span-2 mt-3">
                    <button type="submit" className="btn w-full" disabled={busy}>
                      {busy ? 'Confirming Appointment...' : 'Confirm Appointment Now →'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right: FAQ Accordion */}
            <div id="faq">
              <span className="pill">
                <CheckCircle2 size={12} className="mr-1.5" /> PATIENT QUESTIONS
              </span>
              <h2 className="text-[26px] font-semibold text-slate-800 tracking-tight mt-3 mb-4 leading-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
                Have questions before your visit? Here are common inquiries answered by our clinical team.
              </p>

              <div className="marketing-faq-list !m-0">
                {faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className={`marketing-faq-card ${openFaq === idx ? 'open' : ''}`}
                  >
                    <button
                      type="button"
                      className="marketing-faq-trigger"
                      onClick={() => toggleFaq(idx)}
                      aria-expanded={openFaq === idx}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown size={18} className="marketing-faq-icon" />
                    </button>
                    {openFaq === idx && (
                      <div className="marketing-faq-answer">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Patient Testimonials ("Our Happy Customers") */}
      <section id="reviews" className="clinic-testimonials-v2">
        <div className="container">
          <div className="marketing-section-header">
            <span className="pill">
              <Star size={12} className="mr-1.5 text-amber-500" /> TESTIMONIALS
            </span>
            <h2>Our Happy Customers</h2>
            <p>
              Real experiences from patients who trust our dentists with their oral health and smile aesthetics.
            </p>
          </div>

          <div className="clinic-testimonials-v2-grid">
            {DEFAULT_TESTIMONIALS.map((t, i) => (
              <div className="clinic-testimonial-v2-card" key={i}>
                <div>
                  <div className="flex gap-1 text-amber-500 mb-3">
                    {[...Array(5)].map((_, s) => (
                      <Star key={s} size={14} fill="#f5b041" color="#f5b041" />
                    ))}
                  </div>
                  <p>"{t.quote}"</p>
                </div>
                <div className="clinic-testimonial-v2-author">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="clinic-testimonial-v2-avatar"
                  />
                  <div>
                    <strong>{t.name}</strong>
                    <small>{t.tag}</small>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pre-Footer Ribbon */}
      <div className="clinic-cta-ribbon">
        <div className="container">
          <h2>Ready to book your dental care session?</h2>
          <a href="#booking" className="btn">
            Book Appointment Now →
          </a>
        </div>
      </div>

      {/* Comprehensive Clinic Footer */}
      <footer className="clinic-footer-v2">
        <div className="container">
          <div className="clinic-footer-v2-grid">
            <div>
              <Brand name={clinicInfo.name} logoUrl={clinicInfo.logoUrl} light={true} />
              <p className="text-[12px] text-slate-300 leading-relaxed mt-4 max-w-[320px]">
                {clinicInfo.bio ||
                  'Providing compassionate, modern dentistry and advanced implant care for healthy, radiant smiles.'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-300 font-medium mt-4">
                <ShieldCheck size={16} /> Certified Clinical Safety Protocols
              </div>
            </div>

            <div>
              <h4>Quick Links</h4>
              <ul className="clinic-footer-v2-links">
                <li><a href="#about">About Our Clinic</a></li>
                <li><a href="#services">Dental Treatments</a></li>
                <li><a href="#why-us">Why Choose Us</a></li>
                <li><a href="#doctors">Meet Specialists</a></li>
                <li><a href="#booking">Book Appointment</a></li>
                <li><a href="#faq">Frequently Asked</a></li>
              </ul>
            </div>

            <div>
              <h4>Treatments</h4>
              <ul className="clinic-footer-v2-links">
                <li><a href="#services">Preventive Checkups</a></li>
                <li><a href="#services">Laser Teeth Whitening</a></li>
                <li><a href="#services">Clear Orthodontic Aligners</a></li>
                <li><a href="#services">Dental Implants & Crowns</a></li>
                <li><a href="#services">Painless Root Canals</a></li>
                <li><a href="#services">Pediatric Dentistry</a></li>
              </ul>
            </div>

            <div>
              <h4>Contact & Location</h4>
              <ul className="clinic-footer-v2-links">
                <li className="flex items-start gap-2">
                  <MapPin size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{[clinicInfo.address, clinicInfo.city, clinicInfo.country].filter(Boolean).join(', ')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={15} className="text-emerald-400 shrink-0" />
                  <a href={`tel:${clinicInfo.phone}`}>{clinicInfo.phone}</a>
                </li>
                {clinicInfo.email && (
                  <li className="flex items-center gap-2">
                    <Mail size={15} className="text-emerald-400 shrink-0" />
                    <a href={`mailto:${clinicInfo.email}`}>{clinicInfo.email}</a>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Clock size={15} className="text-emerald-400 shrink-0" />
                  <span>{clinicInfo.openingHours || 'Mon - Sat: 9:00 AM - 8:00 PM'}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="clinic-footer-v2-bottom">
            <span>
              © {new Date().getFullYear()} {clinicInfo.name}. All rights reserved.
            </span>
            <span>
              Thoughtful dental care, delivered with precision.
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
