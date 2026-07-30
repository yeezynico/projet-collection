import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();

    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email et mot de passe obligatoires",
        },
        {
          status: 400,
        },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "Utilisateur déjà existant",
        },
        {
          status: 400,
        },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
      },
    });

    return NextResponse.json(
      {
        message: "Compte créé",
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Erreur serveur",
      },
      {
        status: 500,
      },
    );
  }
}
