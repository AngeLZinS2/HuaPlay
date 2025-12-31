from database import SessionLocal, engine, Base
import models
import datetime

# Create tables if needed
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def seed_data():
    # Check if data exists
    if db.query(models.Series).first():
        print("Data already exists.")
        return

    print("Seeding data...")

    # Series 1
    series1 = models.Series(
        title="Kingdom of Mystery",
        description="Em um reino onde a magia e a tecnologia colidem, um jovem guerreiro deve decidir entre salvar seu povo ou descobri a verdade sobre sua origem.",
        cover_image="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
        banner_image="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2525&auto=format&fit=crop",
        genre="Fantasia",
        country="Coreia do Sul",
        status="Ongoing",
        release_year=2024,
        created_at=datetime.datetime.now()
    )
    db.add(series1)
    db.commit()
    db.refresh(series1)

    # Episodes for Series 1
    ep1 = models.Episode(
        series_id=series1.id,
        title="The Beginning",
        episode_number=1,
        embed_url_1="https://www.youtube.com/embed/dQw4w9WgXcQ",
        created_at=datetime.datetime.now()
    )
    ep2 = models.Episode(
        series_id=series1.id,
        title="Shadows",
        episode_number=2,
        embed_url_1="https://www.youtube.com/embed/dQw4w9WgXcQ",
        created_at=datetime.datetime.now()
    )
    db.add_all([ep1, ep2])

    # Series 2
    series_data = [
        {
            "title": "Kingdom of Mystery",
            "description": "A thrilling mystery drama set in the chaotic era.",
            "cover_image": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=600&auto=format&fit=crop",
            "banner_image": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1200&auto=format&fit=crop",
            "genre": "Suspense, Historical",
            "type": "Series",
            "country": "Korea",
            "status": "Ongoing",
            "release_year": 2024,
            "created_at": datetime.datetime.now()
        },
        {
            "title": "Seoul Nights",
            "description": "Romance blooms under the city lights.",
            "cover_image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=600&auto=format&fit=crop",
            "banner_image": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
            "genre": "Romance",
            "type": "Series",
            "country": "Korea",
            "status": "Completed",
            "release_year": 2023,
            "created_at": datetime.datetime.now()
        },
         {
            "title": "Dragon's Legacy",
            "description": "An epic wuxia adventure.",
            "cover_image": "https://images.unsplash.com/photo-1515286280389-c4ac12bc5800?q=80&w=600&auto=format&fit=crop",
            "banner_image": "https://images.unsplash.com/photo-1515286280389-c4ac12bc5800?q=80&w=1200&auto=format&fit=crop",
            "genre": "Wuxia, Fantasy",
            "type": "Donghua",
            "country": "China",
            "status": "Ongoing",
            "release_year": 2025,
            "created_at": datetime.datetime.now()
        }
    ]

    for s_data in series_data:
        series = models.Series(**s_data)
        db.add(series)
        db.commit()
        db.refresh(series)
    print("Seeding complete!")

if __name__ == "__main__":
    seed_data()
