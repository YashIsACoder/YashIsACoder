from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
import sys

OUT = sys.argv[1]
INK = colors.HexColor('#1f2230'); MUTED = colors.HexColor('#4a4f63'); ACC = colors.HexColor('#5b3fb0')
BODY = 10.5

name = ParagraphStyle('name', fontName='Helvetica-Bold', fontSize=21, leading=24, textColor=INK)
role = ParagraphStyle('role', fontName='Helvetica', fontSize=11.5, leading=15, textColor=ACC)
contact = ParagraphStyle('contact', fontName='Helvetica', fontSize=9.5, leading=13, textColor=MUTED)
h = ParagraphStyle('h', fontName='Helvetica-Bold', fontSize=10.5, leading=13, textColor=ACC, spaceBefore=7, spaceAfter=2)
title = ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=BODY, leading=13.5, textColor=INK)
date = ParagraphStyle('date', parent=title, fontName='Helvetica', textColor=MUTED, alignment=2)
sub = ParagraphStyle('sub', fontName='Helvetica-Oblique', fontSize=BODY - .5, leading=13, textColor=MUTED)
body = ParagraphStyle('body', fontName='Helvetica', fontSize=BODY, leading=13.6, textColor=INK)
bullet = ParagraphStyle('bullet', parent=body, leftIndent=11, bulletIndent=1, spaceBefore=1.2)

W = A4[0] - 32 * mm - 12  # the frame keeps 6pt padding each side
def head(t):
    return [Paragraph(t.upper(), h), HRFlowable(width='100%', thickness=0.6, color=colors.HexColor('#c9c6d8'), spaceBefore=0, spaceAfter=4)]
def row(left, right, subline=None):
    t = Table([[Paragraph(left, title), Paragraph(right, date)]], colWidths=[W * 0.72, W * 0.28])
    t.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0), ('VALIGN', (0, 0), (-1, -1), 'BOTTOM')]))
    out = [Spacer(1, 4), t]
    if subline: out.append(Paragraph(subline, sub))
    return out
def bullets(items):
    return [Paragraph(i, bullet, bulletText='•') for i in items]

s = []
s += [Paragraph('Yashwanth Madan', name), Paragraph('Software engineering · Quantitative development · Data', role), Spacer(1, 2),
      Paragraph('Sydney, Australia · Australian citizen · yashwanth.madan7070@gmail.com<br/>'
                'github.com/YashIsACoder · linkedin.com/in/yashwanth-madan-7ab57b282 · yashisacoder.github.io/YashIsACoder', contact)]

s += head('Education')
s += row('UNSW Sydney', 'Expected 2028', 'Bachelor of Computer Science / Bachelor of Advanced Science (Honours)')
s += bullets([
    'Coursework: Data and Algorithms in Trading (with Optiver), Extended Algorithm Design, Data Structures and Algorithms, Computer Systems, Networks.',
    '<b>1st place</b>, UNSW &amp; ANZHFR Health Datathon (Dec 2025): team model predicting post-operative delirium.'])

s += head('Experience')
s += row('Commonwealth Bank of Australia', 'Mar – Sep 2026', 'Data Science &amp; Decisions Intern, Institutional Banking &amp; Markets')
s += bullets([
    'Built a tick-level market replay platform for futures and commodities data, helping traders analyse execution quality and intraday liquidity.',
    'Developed fixed-income desk analytics surfacing credit spreads, pricing and relative-value signals for high-grade bonds.',
    'Automated model deployment and monitoring with GitHub Actions, reducing manual work in the release process.'])
s += row('UNSW School of Computer Science &amp; Engineering', '2026', 'Tutor, COMP3110')
s += row('Sunswift Racing (UNSW solar car team)', 'Apr 2025 – May 2026', 'Performance Optimisation Engineer')
s += bullets([
    'Built predictive pipelines that recommend adaptive race speeds from telemetry and environmental data.',
    'Developed Monte Carlo simulations comparing race strategies under changing weather, terrain and energy constraints; supported the 2025 race from Race Control.'])
s += row('Sydney Swans', 'Feb – May 2025', 'Data Engineering Intern')
s += bullets([
    'Built an AWS data lake (S3, Lambda, Glue, Athena) consolidating sports performance datasets for analysis.',
    'Automated REST API ingestion and optimised SQL ETL workflows, cutting processing time by 50%.'])

s += head('Projects')
s += row('ECM: energy consumption model for solar-electric vehicles', 'C++20 · CMake · pybind11')
s += bullets(['Four vehicle energy models and a Monte Carlo route lab with paired-weather experiments and O(1)-memory confidence intervals; Python bindings.'])
s += row('Payoff Lab: options portfolio and Greeks simulator', 'TypeScript · React')
s += bullets(['Built for MATH2991. Combine calls, puts and futures; vary volatility and time to expiry to see value, payoff and Greeks move together.'])
s += row('LeetRun and QuantSprint: practice tools', 'TypeScript · Next.js · SQLite')
s += bullets(['Interview-practice app with an Elo rating model over 4,119 problems and 90+ test files; a mental-arithmetic trainer with response-time analytics.'])

s += row('cpp-mlp: neural network from scratch', 'C++17 · Eigen')
s += bullets(['Dense layers and hand-written backpropagation, trained and evaluated on MNIST.'])

s += head('Skills')
s += [Paragraph('<b>Languages:</b> C++ (17/20), Python, TypeScript/JavaScript, SQL, C, Bash', body),
      Paragraph('<b>Quant &amp; data:</b> Monte Carlo simulation, statistics, experimental design, options and Greeks, market data', body),
      Paragraph('<b>Tools:</b> CMake, Git, GitHub Actions, Docker, Linux, AWS (S3, Lambda, Glue, Athena), React, Next.js', body)]

doc = SimpleDocTemplate(OUT, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=12 * mm, bottomMargin=10 * mm,
                        title='Yashwanth Madan · CV', author='Yashwanth Madan', subject='Curriculum vitae')
doc.build(s)
