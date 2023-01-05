const { Op } = require("sequelize");
const data = require("./api.json");
const { Users, Courses, Categories, Reviews } = require("../db");
const nodemailer = require("nodemailer");
const { CLIENT_STRIPE_KEY } = process.env;
const Stripe = require("stripe");
const { json } = require("body-parser");
const stripe = new Stripe(CLIENT_STRIPE_KEY);


const postCourse = async (req, res) => {
  const {
    nombre,
    descripcion,
    instuctor,
    duracion,
    precio,
    imagen,
    dificultad,
    categoria,
  } = req.body;

  let name,
    description,
    instructor,
    duration,
    price,
    image,
    difficulty,
    categoryId;

  name = nombre.toUpperCase();
  description = descripcion;
  instructor = instuctor;
  duration = duracion;
  price = precio;
  image = imagen;
  difficulty = dificultad;
  categoryId = categoria;

  try {
    // valido que existan los datos obligatorios
    if (!name || !description)
      return res.status(400).send("Faltan datos obligatorios.");

    const newcourse = await Courses.create({
      name,
      description,
      instructor,
      duration,
      price,
      image,
      difficulty,
      categoryId,
    });

    res.status(200).send("El curso ha sido creado exitosamente!");
  } catch (error) {
    res.status(400).send(error);
  }
};

//loadCoursesToDB es solo para cargar los cursos del json a la DB
//la ruta en Postman seria http://localhost:3001/course/load

const loadCoursesToDB = async () => {
  const coursesDB = await Courses.findAll();
  const coursesJSON = data.cursos;
  const categoriesJSON = data.categorys;
  const categoriesDB = await Categories.findAll();

  if (categoriesDB.length === 0) {
    categoriesJSON.forEach(async (e) => {
      await Categories.create({
        name: e.name,
      });
    });
  }

  if (coursesDB.length === 0) {
    coursesJSON.forEach(async (e) => {
      let name, description, rating, image, difficulty, price, categoryId;

      name = e.nombre.toUpperCase();
      description = e.descripcion;
      instructor = e.instructor;
      price = e.precio;
      duration = e.duracion;
      rating = e.rating;
      image = e.imagen;
      difficulty = e.dificultad;
      price = e.precio;
      categoryId = parseInt(e.idCategoria);

      await Courses.create({
        name,
        description,
        instructor,
        price,
        duration,
        rating,
        image,
        difficulty,
        price,
        categoryId,
      });
    });
  }
};

//funcion para buscar el nombre del curso que recibio por query
const findByName = async (name) => {
  let courses = await Courses.findAll({
    where: {
      name: {
        [Op.like]: `%${name}%`,
      },
    },
    include: [
      {
        model: Categories,
        attributes: ["name"],
      },
    ],
  });
  return courses;
};

const getCourseById = async (req, res) => {
  const { id } = req.params;
  try {
    if (id) {
      const course = await Courses.findByPk(id);
      if (course) {
        res.status(200).json(course);
      } else {
        res.status(404).json({
          message: `No se encontró el curso con el número de id ${id}`,
        });
      }
    } else {
      res.status(400).json({ message: "No se ingresó un id" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

//trae todos los cursos junto con las reviews asociadas ==> traía
//agregue las categorias y saque el review porque no se como poner 2 :P
const getAllCourses = async (req, res) => {
  try {
    let name = req.query.name;
    let courses;
    if (name) {
      name = name.toUpperCase();
      courses = await findByName(name);
    } else {
      courses = await Courses.findAll({
        include: Categories,
      });
    }
    courses = courses.map((c) => {
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        instructor: c.instructor,
        duration: c.duration,
        price: c.price,
        fecha: c.fecha,
        rating: c.rating,
        image: c.image,
        active: c.active,
        difficulty: c.difficulty,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        categories: c.categories.map((c) => c.name),
      };
    });

    if (courses.length > 0) {
      return res.status(200).send(courses);
    }
    res.status(404).send({ message: "No se encontraron cursos" });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
};

//se postea una review y se asocia con el ID del curso
const postReview = async (req, res) => {
  try {
    let { name, text, rating, courseId } = req.body;
    const newReview = await Reviews.create({
      name,
      text,
      rating,
      courseId: courseId,
    });
    res.status(200).send({ message: "Reseña creada con exito" });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
};

//Crear un nuevo usuario (ruta de prueba para deshabilitar usuarios)
const createUser = async (req, res) => {
  const user = req.body;

  // console.log(user.email);

  let name, lastname, email, email_verified, birthday;

  name = user.given_name || user.name;
  lastname = user.family_name || "";
  email = user.email;
  email_verified = user.email_verified;
  birthday = "";
  (admin = false), (active = true);

  try {
    const [usuario, craeted] = await Users.findOrCreate({
      where: { email: user.email },
      defaults: {
        name,
        lastname,
        email,
        email_verified,
        birthday,
        admin,
        active,
      },
    });
    res.status(200).json({ usuario, craeted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

//Deshabilita el usuario por mail o id
const disableUser = async (req, res) => {
  const { mail, id } = req.query;

  try {
    if (id) {
      const userId = await Users.findByPk(id);
      userId.active = false;
      await userId.save();
      res.status(200).json({ message: "Usuario deshabilitado" });
    } else if (mail) {
      const userMail = await Users.findOne({ where: { mail } });
      userMail.active = false;
      await userMail.save();
      res.status(200).json({ message: "Usuario deshabilitado" });
    } else {
      res.status(404).json({ message: "Usuario no encontrado" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Categories.findAll();

    if (categories.length > 0) {
      res.status(200).json(categories);
    } else {
      res.status(404).send("no se encontraron categorias");
    }
  } catch (error) {
    res.status(400).send(`ocurrio un error ${error}`);
  }
};

const postCategory = async (req, res) => {
  const { name } = req.body;
  try {
    await Categories.create({ name });
    res.status(200).send("La categoría ha sido creada con éxito.");
  } catch (error) {
    res.status(400).send(`ocurrio un error ${error}`);
  }
};

//filtra cursos por categorias
const getCoursesByCategory = async (req, res) => {
  const { id } = req.query;
  const courses = await Courses.findAll({
    include: {
      model: Categories,
      attributes: ["id", "name"],
      through: {
        attributes: [],
      },
    },
  });

  if (id) {
    const filterCategory = courses.filter((course) =>
      course.categories.find((categorie) => categorie.id == id)
    );

    if (filterCategory.length) {
      res.send(filterCategory);
    } else {
      res.status(404).send("No se encontraron cursos");
    }
  } else {
    res.status(200).send(courses);
  }
};

//filtra cursos por dificultad
const getCoursesByDifficulty = async (difficulty) => {
  if (difficulty) {
    const courses = await Courses.findAll();
    const filterDifficulty = courses.filter(
      (course) => course.difficulty.toLowerCase() == difficulty.toLowerCase()
    );

    if (filterDifficulty.length) {
      return filterDifficulty;
    } else {
      throw new Error("No se encontraron cursos");
    }
  } else {
    throw new Error("No se ingresó una dificultad");
  }
};

//filtra cursos por duracion
const getCoursesByDuration = async (duration) => {
  if (duration) {
    const courses = await Courses.findAll();
    if (duration == "1A50") {
      const filterDuration = courses.filter(
        (course) => course.duration >= 1 && course.duration <= 50
      );
      if (filterDuration.length) {
        return filterDuration;
      } else {
        throw new Error("No se encontraron cursos");
      }
    } else if (duration == "51A100") {
      const filterDuration = courses.filter(
        (course) => course.duration > 50 && course.duration <= 100
      );
      if (filterDuration.length) {
        return filterDuration;
      } else {
        throw new Error("No se encontraron cursos");
      }
    } else if (duration == "100") {
      const filterDuration = courses.filter((course) => course.duration >= 101);
      if (filterDuration.length) return filterDuration;
    } else {
      throw new Error("No se encontraron cursos");
    }
  } else {
    throw new Error("No se ingresó una duración");
  }
};

const filterCourses = async (req, res) => {
  const { id, difficulty, duration } = req.query;

  // console.log('duration', duration)
  // console.log('difficulty',difficulty)

  try {
    if (id) {
      const courses = await getCoursesByCategory(id);
      res.status(200).json(courses);
    } else if (difficulty) {
      const courses = await getCoursesByDifficulty(difficulty);
      res.status(200).json(courses);
    } else if (duration) {
      const courses = await getCoursesByDuration(duration);
      res.status(200).json(courses);
    } else {
      res.status(200).json("no mando ninguna query");
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const contactMail = (req, res) => {
  const { name, mail, message } = req.body;

  if (!name) res.status(500).json("Debe incluir el nombre. Vuelva a intenar");

  // let newText = `${name} - ${email} - ${content}`
  let html = `<div>
    <h3> Name - ${name}</h3>
    <h3> Mail - ${mail}</h3>
    <h2>Message - ${message}</h2>
  </div>`;

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: "cursort.2022@gmail.com", // generated ethereal user
      pass: "cghynjlxmrlbasyt", // generated ethereal password
    },
  });

  let mailOption = {
    from: "Cursort contact", // sender address
    to: "cursort.2022@gmail.com", // list of receivers
    subject: "Cotact Form", // Subject line
    // text: newText, // plain text body
    html: html,
  };
  transporter.sendMail(mailOption, (error, info) => {
    if (error) {
      res.status(500).json(error.message);
    } else {
      res.status(200).json("Email enviado con exito");
    }
  });
};

// // post para realizar pago
// const postPayment = async (req, res) => {
//   const { id, email, amount, description } = req.body;
//   try {
//     const payment = await Payment.create({
//       id,
//       email,
//       amount,
//       description,
//     });
//     res.status(200).json(payment);
//   } catch (error) {
//     res.status(400).json(error.message);
//   }
// };

// post para realizar pago
const postPayment = async (req, res, next) => {
  const { id, amount } = req.body;
  try {
    const payment = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method: id,
      description: "Pago de curso",
      confirm: true,
    });

    res.send({ message: "Pago realizado con éxito" });

    next();
  } catch (error) {
    res.json({ message: error.raw.message });
  }
};

/*
¿que voy a mandar en el mail?
- Datos del usuario : Nombre - Mail - detalle de cursos que compro {nombre:'',precio:''} - 
-link de acceso a los cursos
- verificar que este confirmado el pago: {confirm: true}

------

*/


const linkMail = async (req, res, next) => {
  let { mail, name, id_cursos} = req.body;

  //---- Esto recibe un [] con los id de los cursos pero no puedo incluirlos en el mail. Igual recibe el mail de confirmacion

//   const cursosPay = id_cursos.map((id)=>{
//    return Courses.findByPk(id);    
//   })  
//   const promesas = await Promise.all(cursosPay)

//  const promesasListas =  promesas.map(p=>{
//   return {
//     nombre : p.name,
//     precio: p.price,
//     imagen : p.image
//   }
//  })

  if (!mail)res.status(500).json("Faltan campos obligatorios, controle y vuelva a enviar");

  // Falta agregar el link a donde se van a renderizar los cursos.
  let html = `<div>
    <h3> ${name}! Gracias por confiar en Cursort \n ya está diponible tu curso, puedes ingresar en el siguiente link</h3>
    <button><p> http://localhost:3000 </p></button> 
  </div>`

  //esto le da acceso a nodemailer al mail de cursort
  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: "cursort.2022@gmail.com", // generated ethereal user
      pass: "cghynjlxmrlbasyt", // generated ethereal password
    },
  });

  //esto es la configuracion del Mail
  let mailOption1 = {
    from: 'Cursort - Facturación', // sender address
    to: mail , // puede recibir [] con mails para enviar en cadena
    subject: 'confirmación de compra', //
    // text: newText, // plain text body
    html: html
  };

  transporter.sendMail(mailOption1, (error, info) => {
    if (error) {
      res.status(500).json(error.message);
    } else {
      res.status(200).json(`Email enviado con exito a ${mail}`);
      next()
    }
  });
};

module.exports = {
  postCourse,
  getAllCourses,
  getCourseById,
  postReview,
  loadCoursesToDB,
  createUser,
  disableUser,
  getCategories,
  postCategory,
  getCoursesByCategory,
  getCoursesByDifficulty,
  getCoursesByDuration,
  filterCourses,
  contactMail,
  postPayment,
  linkMail,
};
