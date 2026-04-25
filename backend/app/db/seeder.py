from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Driver, KnowledgeDocument, Race, Result, User
from app.utils.passwords import hash_password

SEEDED_DRIVERS = [
    (1, "Max Verstappen", "Red Bull"),
    (2, "Lando Norris", "McLaren"),
    (3, "Charles Leclerc", "Ferrari"),
    (4, "Lewis Hamilton", "Mercedes"),
    (5, "Sergio Perez", "Red Bull"),
    (6, "Oscar Piastri", "McLaren"),
    (7, "Carlos Sainz", "Ferrari"),
    (8, "George Russell", "Mercedes"),
    (9, "Fernando Alonso", "Aston Martin"),
    (10, "Lance Stroll", "Aston Martin"),
    (11, "Pierre Gasly", "Alpine"),
    (12, "Esteban Ocon", "Alpine"),
    (13, "Yuki Tsunoda", "RB"),
    (14, "Daniel Ricciardo", "RB"),
    (15, "Alex Albon", "Williams"),
    (16, "Logan Sargeant", "Williams"),
    (17, "Valtteri Bottas", "Sauber"),
    (18, "Zhou Guanyu", "Sauber"),
    (19, "Nico Hulkenberg", "Haas"),
    (20, "Kevin Magnussen", "Haas"),
]

SEEDED_RACES = [
    (1, "Silverstone", "2025-07-06"),
    (2, "Monza", "2025-09-07"),
    (3, "Australia", "2025-03-16"),
    (4, "China", "2025-03-23"),
    (5, "Japan", "2025-04-06"),
    (6, "Bahrain", "2025-04-13"),
    (7, "Saudi Arabia", "2025-04-20"),
    (8, "Miami", "2025-05-04"),
    (9, "Emilia Romagna", "2025-05-18"),
    (10, "Monaco", "2025-05-25"),
    (11, "Spain", "2025-06-01"),
    (12, "Canada", "2025-06-15"),
    (13, "Austria", "2025-06-29"),
    (14, "Belgium", "2025-07-27"),
    (15, "Hungary", "2025-08-03"),
    (16, "Netherlands", "2025-08-31"),
    (17, "Azerbaijan", "2025-09-21"),
    (18, "Singapore", "2025-10-05"),
    (19, "United States", "2025-10-19"),
    (20, "Mexico City", "2025-10-26"),
    (21, "Sao Paulo", "2025-11-09"),
    (22, "Las Vegas", "2025-11-22"),
    (23, "Qatar", "2025-11-30"),
    (24, "Abu Dhabi", "2025-12-07"),
]

SEEDED_RESULTS = [
    (1, 2, 2, 25),
    (2, 1, 2, 18),
    (3, 3, 2, 15),
    (4, 6, 2, 12),
    (5, 4, 2, 10),
    (6, 8, 2, 8),
    (7, 7, 2, 6),
    (8, 9, 2, 4),
    (9, 11, 2, 2),
    (10, 13, 2, 1),
]

TEAM_KNOWLEDGE = [
    ("team-red-bull", "Red Bull is known for strong high-speed performance, efficient aerodynamics, and aggressive race execution."),
    ("team-mclaren", "McLaren has been competitive on both qualifying pace and tyre management, with a driver lineup built around Lando Norris and Oscar Piastri."),
    ("team-ferrari", "Ferrari combines strong one-lap pace with a historically huge fanbase. Its recent performance has often depended on tyre management and operational sharpness."),
    ("team-mercedes", "Mercedes is one of the most successful teams in modern Formula 1 history, known for technical depth, hybrid-era dominance, and disciplined race operations."),
    ("team-aston-martin", "Aston Martin focuses on aerodynamic efficiency and race execution, often leaning on Fernando Alonso's experience to maximise Sundays."),
    ("team-alpine", "Alpine has tended to fight in the midfield, where setup direction, reliability, and strategy timing can make a large difference."),
    ("team-rb", "RB, formerly AlphaTauri, operates as Red Bull's sister team and often develops young drivers while competing in the midfield."),
    ("team-williams", "Williams is one of Formula 1's historic names and often targets efficiency and straight-line competitiveness as it rebuilds toward the front."),
    ("team-sauber", "Sauber has frequently relied on clean execution and efficient packaging in the midfield while preparing for its future Audi-linked era."),
    ("team-haas", "Haas often focuses on extracting value from simplified operational structures, where tyre behaviour and race management can decide its points chances."),
]

DRIVER_KNOWLEDGE = [
    ("driver-max-verstappen", "Max Verstappen is a Formula 1 world champion known for aggressive racecraft, strong race pace, and efficient tyre management for Red Bull."),
    ("driver-sergio-perez", "Sergio Perez is known for long-run tyre preservation, opportunistic race craft, and experience in strategic race situations."),
    ("driver-lando-norris", "Lando Norris is a McLaren Formula 1 driver known for speed over one lap, strong race pace, and detailed feedback on car balance."),
    ("driver-oscar-piastri", "Oscar Piastri is a McLaren Formula 1 driver known for calm execution, high qualifying ceiling, and composed race management."),
    ("driver-charles-leclerc", "Charles Leclerc is a Ferrari Formula 1 driver known for elite qualifying speed, commitment on corner entry, and aggressive attacking laps."),
    ("driver-carlos-sainz", "Carlos Sainz is known for strategic thinking, smooth race management, and adaptability across different race scenarios."),
    ("driver-lewis-hamilton", "Lewis Hamilton is a seven-time world champion known for tyre management, wet-weather ability, racecraft, and sustained elite performance."),
    ("driver-george-russell", "George Russell is known for strong qualifying pace, confidence in high-speed corners, and assertive wheel-to-wheel racing."),
    ("driver-fernando-alonso", "Fernando Alonso is a two-time world champion known for race intelligence, defensive skill, tyre management, and tactical awareness."),
    ("driver-lance-stroll", "Lance Stroll is an Aston Martin Formula 1 driver with experience across mixed conditions and midfield race scenarios."),
    ("driver-pierre-gasly", "Pierre Gasly is known for aggressive commitment, strong midfield race pace, and sharp qualifying laps."),
    ("driver-esteban-ocon", "Esteban Ocon is known for consistency, defensive racing, and extracting results from tightly packed midfield races."),
    ("driver-yuki-tsunoda", "Yuki Tsunoda is known for quick reactions, sharp front-end preference, and improving consistency over race distances."),
    ("driver-daniel-ricciardo", "Daniel Ricciardo is known for late-braking overtakes, confident attacks into heavy-stop corners, and strong race instinct."),
    ("driver-alex-albon", "Alex Albon is known for extracting performance from difficult cars and producing strong race management in midfield machinery."),
    ("driver-logan-sargeant", "Logan Sargeant is an American Formula 1 driver who developed through the junior ladder before stepping into the Williams seat."),
    ("driver-valtteri-bottas", "Valtteri Bottas is known for clean qualifying speed, technical feedback, and experience across top-team and midfield environments."),
    ("driver-zhou-guanyu", "Zhou Guanyu is known for measured race execution and calm adaptation to changing race situations."),
    ("driver-nico-hulkenberg", "Nico Hulkenberg is known for qualifying sharpness, technical experience, and dependable midfield performance."),
    ("driver-kevin-magnussen", "Kevin Magnussen is known for direct racecraft, aggressive defence, and physical commitment in close racing."),
]

SEEDED_KNOWLEDGE = [
    (
        "tyre-degradation",
        "Tyre degradation increases when average throttle application stays high through traction zones and drivers overheat the rear axle.",
    ),
    (
        "pit-window",
        "An undercut becomes more effective when clean air yields at least 1.5 seconds of lap time delta over an aging tyre stint.",
    ),
    (
        "fuel-management",
        "Lift-and-coast can protect brakes and save fuel, but it usually sacrifices entry speed and overall race time if overused.",
    ),
    (
        "silverstone",
        "Silverstone rewards aerodynamic efficiency, confidence through high-speed corners, and disciplined tyre temperature management.",
    ),
    (
        "tyre-compounds",
        "Soft tyres usually switch on faster and produce more grip over a short stint, while hard tyres trade outright pace for durability and longer life.",
    ),
    (
        "compound-strategy",
        "Teams choose soft compounds when immediate lap time, warm-up, or qualifying-style grip matters more than stint length; hard compounds are favored when tyre life and stability are the priority.",
    ),
    (
        "f1-points-system",
        "In modern Formula 1, the top ten classified finishers score points on a 25-18-15-12-10-8-6-4-2-1 scale. An extra point can be awarded for the fastest lap if the driver also finishes in the top ten, subject to the rules in force for that season.",
    ),
    (
        "drs",
        "DRS stands for Drag Reduction System. It opens a flap in the rear wing to reduce drag and increase straight-line speed, but drivers can only use it in designated zones and when they are within the required gap to the car ahead during race conditions.",
    ),
    (
        "ers",
        "ERS is the Energy Recovery System. It harvests energy from braking and exhaust heat and then redeploys that electrical energy to improve acceleration and straight-line performance.",
    ),
    (
        "qualifying-format",
        "A standard Formula 1 qualifying session is split into Q1, Q2, and Q3. Cars are progressively eliminated after Q1 and Q2, and the remaining runners fight for pole position in Q3.",
    ),
    (
        "sprint-format",
        "Sprint weekends add a shorter race and a separate sprint qualifying-style session to the normal event structure. The exact format can change by season, but the core idea is to create a second competitive session before the Grand Prix.",
    ),
    (
        "safety-car",
        "The Safety Car compresses the field and reduces race speed after incidents or unsafe track conditions. Strategy can swing sharply under a Safety Car because pit-stop time loss is smaller when the field is circulating slowly.",
    ),
    (
        "virtual-safety-car",
        "The Virtual Safety Car requires drivers to follow a reference delta rather than bunching behind a physical Safety Car. It can still create strategic pit opportunities, but usually with less field reshuffling than a full Safety Car.",
    ),
    (
        "parc-ferme",
        "Parc ferme rules restrict how much teams can change the car setup after qualifying starts. That means teams must balance one-lap speed and race pace before they fully understand how the weekend will unfold.",
    ),
    (
        "track-limits",
        "Track limits rules normally require drivers to keep the car within the white lines that define the circuit. Repeated violations can lead to lap deletions in qualifying or time penalties in the race.",
    ),
    (
        "wet-weather-tyres",
        "Intermediate tyres are used for damp conditions without standing water, while full wets are designed for heavy rain and significant spray. Choosing the crossover point correctly is one of the biggest wet-race strategy calls.",
    ),
    (
        "undercut-vs-overcut",
        "An undercut relies on pitting earlier to use fresh tyres for a lap-time advantage, while an overcut stays out longer and tries to benefit from track position or cleaner late-stint pace. Which one works depends on tyre warm-up, degradation, traffic, and pit-loss timing.",
    ),
    (
        "overtaking",
        "Successful overtaking in Formula 1 usually depends on exit speed, battery deployment, tyre condition, slipstream effect, and whether the chasing car can stay close enough through the final corner to attack on the straight.",
    ),
    (
        "soft-vs-hard",
        "Soft tyres generally provide more grip and warm up quickly, which makes them faster over short runs. Hard tyres usually deliver lower peak grip, but they stay alive longer and are better for long stints or hot, abrasive races.",
    ),
    (
        "world-champions",
        "Lewis Hamilton and Michael Schumacher share the record for the most Formula 1 World Drivers' Championship titles with seven each.",
    ),
    (
        "constructors-championship",
        "The Constructors' Championship is decided by the combined points scored by both cars from each team across the season. It rewards overall team performance, reliability, and operational quality, not just one standout driver.",
    ),
    (
        "pit-stops",
        "A good pit stop balances total stationary time, safe release, and the in-lap to out-lap transition. Strategy value comes from the whole pit sequence, not just the stop itself.",
    ),
    (
        "power-units",
        "Modern Formula 1 power units combine an internal combustion engine with hybrid electrical systems. Energy deployment, harvesting, and cooling all affect race pace and overtaking potential.",
    ),
    (
        "dirty-air",
        "Dirty air reduces front-end grip for the chasing car because turbulent airflow disrupts the aerodynamics. That makes tyre wear worse and can stop a faster car from following closely through corners.",
    ),
    (
        "pole-position",
        "Pole position is awarded to the fastest driver in the final qualifying segment. Starting first can be a major advantage, especially at circuits where overtaking is difficult.",
    ),
    (
        "blue-flags",
        "Blue flags tell a slower car, usually one being lapped, that a faster car is approaching and should be allowed through safely without unnecessary delay.",
    ),
    (
        "red-flag",
        "A red flag stops the session or race because conditions are too dangerous to continue. Teams can sometimes use the stoppage to reset strategy, repair damage, or change tyres depending on the rules and timing.",
    ),
    (
        "formation-lap",
        "The formation lap lets drivers warm tyres, brakes, and powertrain systems before the start. It also gives teams one last read on grip and procedures before the lights go out.",
    ),
    (
        "aerodynamics",
        "Aerodynamics shape how efficiently a Formula 1 car produces downforce and manages drag. Teams trade top speed against cornering grip depending on the circuit layout.",
    ),
    (
        "cost-cap",
        "The cost cap limits most team spending across the season to control costs and narrow the competitive gap. It influences upgrade timing, staffing choices, and how aggressively teams can develop the car.",
    ),
    (
        "team-orders",
        "Team orders are instructions given by a team to influence the behavior of its drivers, often to protect points, manage strategy, or support a championship campaign.",
    ),
    (
        "stewards-and-penalties",
        "Stewards review incidents and can issue warnings, grid drops, time penalties, drive-throughs, stop-go penalties, and disqualifications depending on the severity of the offence.",
    ),
    (
        "fastest-lap",
        "Fastest lap refers to the quickest single lap completed during the race. Depending on the season's rules, it may or may not award an extra championship point.",
    ),
    (
        "marbles",
        "Marbles are small pieces of discarded tyre rubber that collect off the racing line. Running through them can reduce grip and raise tyre temperatures.",
    ),
    (
        "slipstream",
        "Slipstreaming reduces aerodynamic drag by following another car closely on the straight, helping the trailing driver gain speed before attempting an overtake.",
    ),
    (
        "brake-bias",
        "Brake bias controls how braking force is split between the front and rear axles. Drivers adjust it to manage entry stability, rear locking, and braking confidence.",
    ),
    (
        "downforce",
        "Downforce pushes the car into the track, improving cornering grip. More downforce usually helps in corners but often increases drag on straights.",
    ),
    (
        "diffuser-and-floor",
        "The floor and diffuser are critical downforce-generating areas on a modern Formula 1 car. Ground-effect performance depends heavily on how efficiently they manage airflow under the car.",
    ),
    (
        "tyre-blankets",
        "Tyre blankets preheat tyres before they are fitted to the car, helping drivers reach a usable operating window faster after leaving the pits.",
    ),
    (
        "pit-lane-speed-limit",
        "The pit lane speed limit reduces risk in the pit area. Exceeding it brings a penalty because the pit lane is a controlled operational zone.",
    ),
    (
        "scrutineering",
        "Scrutineering is the technical inspection process that checks whether a car complies with the regulations before and after sessions.",
    ),
    (
        "reserve-drivers",
        "Reserve drivers support teams with simulator work, testing, and standby race duties in case a race driver cannot compete.",
    ),
    (
        "rookie-sessions",
        "Teams are required to complete rookie practice appearances under modern rules, giving young drivers seat time during official race weekends.",
    ),
]


def seed_database(db: Session) -> None:
    existing_user = db.scalar(select(User).where(User.username == "demo"))
    if not existing_user:
        db.add(
            User(
                username="demo",
                full_name="Demo Engineer",
                role="Race Strategist",
                favorite_team="McLaren",
                favorite_driver="Lando Norris",
                location="Bengaluru, India",
                profile_image="",
                bio="Telemetry-first race fan building faster reads on drivers, tyre life, and strategy windows.",
                hashed_password=hash_password("demo123"),
            )
        )
    else:
        existing_user.full_name = existing_user.full_name or "Demo Engineer"
        existing_user.role = existing_user.role or "Race Strategist"
        existing_user.favorite_team = existing_user.favorite_team or "McLaren"
        existing_user.favorite_driver = existing_user.favorite_driver or "Lando Norris"
        existing_user.location = existing_user.location or "Bengaluru, India"
        existing_user.profile_image = existing_user.profile_image or ""
        existing_user.bio = (
            existing_user.bio
            or "Telemetry-first race fan building faster reads on drivers, tyre life, and strategy windows."
        )

    existing_drivers = {
        driver.name: driver
        for driver in db.scalars(select(Driver)).all()
    }
    for driver_id, name, team in SEEDED_DRIVERS:
        existing_driver = existing_drivers.get(name)
        if existing_driver:
            existing_driver.team = team
        else:
            db.add(Driver(id=driver_id, name=name, team=team))

    existing_races = {
        race.track: race
        for race in db.scalars(select(Race)).all()
    }
    for race_id, track, date in SEEDED_RACES:
        existing_race = existing_races.get(track)
        if existing_race:
            existing_race.date = date
        else:
            db.add(Race(id=race_id, track=track, date=date))

    existing_result_keys = {
        (result.driver_id, result.race_id)
        for result in db.scalars(select(Result)).all()
    }
    for position, driver_id, race_id, points in SEEDED_RESULTS:
        if (driver_id, race_id) not in existing_result_keys:
            db.add(Result(position=position, driver_id=driver_id, race_id=race_id, points=points))

    existing_docs = {
        document.topic: document
        for document in db.scalars(select(KnowledgeDocument)).all()
    }
    for topic, content in SEEDED_KNOWLEDGE + TEAM_KNOWLEDGE + DRIVER_KNOWLEDGE:
        existing_doc = existing_docs.get(topic)
        if existing_doc:
            existing_doc.content = content
        else:
            db.add(KnowledgeDocument(topic=topic, content=content))

    db.commit()
