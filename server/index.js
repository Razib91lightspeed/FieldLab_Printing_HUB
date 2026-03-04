import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = 4000;

app.get("/api/peppi", async (req, res) => {

  try {

    const url =
      "https://peppi-utils.tuni.fi/tilakalenteri/bin/varaukset.cal.php";

    const now = new Date();

    const start =
      `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}T00:00:00`;

    const end =
      `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()+7).padStart(2,"0")}T00:00:00`;

    const form = new URLSearchParams();

    form.append("h[]","3D tulostin_F0-16, Bambu A1");
    form.append("h[]","3D tulostin_F0-16, Bambu A2");
    form.append("h[]","3D tulostin_F0-16, Bambu A3");
    form.append("h[]","3D tulostin_F0-16, Bambu A4");
    form.append("h[]","3D tulostin_F0-16, Bambu A5 AMS");

    form.append("ta","F-talo");
    form.append("taloIdx","152");
    form.append("orgID","tamk");

    form.append("start",start);
    form.append("end",end);

    const response = await fetch(url,{
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      body:form.toString()
    });

    const data = await response.json();

    console.log("PEPPI BOOKINGS:",data);

    res.json(data);

  } catch(err){

    console.error(err);
    res.status(500).send("Peppi request failed");

  }

});

app.listen(PORT,()=>{
  console.log("Server running on port",PORT);
});